import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { analyzeLegoPhoto, demoPieces, visionProvider, type DetectedPiece, type LegoColor, type LegoShape, type VisionResult } from './src/vision';
import { catalog, describePiece, displayHex, getPart } from './src/catalog';
import { isVoiceEnabled, say, sayBilingual, setVoiceEnabled } from './src/voice';
import { LINES } from './src/voice/lines';

type Screen = 'home' | 'scan' | 'ideas' | 'preview' | 'builder' | 'creator' | 'complete' | 'book';
type BrickColor = LegoColor;
type BrickShape = LegoShape;

const C = { blue:'#0877E8', dark:'#0754A6', pale:'#E3F3FF', yellow:'#FFD524', red:'#EC3D3D', green:'#29AD66', ink:'#14233A', gray:'#65758B', paper:'#F7FBFF', white:'#FFFFFF' };
// Official LEGO colors from the verified catalog (Rebrickable RGB), keyed by kid color word.
const brickColors = Object.fromEntries(catalog.colors.map(color => [color.kid, displayHex(color.id)])) as Record<BrickColor, string>;
// Alex's demo pieces: real part numbers + colors, verified against the catalog at startup.
const inventory: DetectedPiece[] = demoPieces();

type BuildStep = { text: string; hint: string; partNum: string; colorId: number; qty: number };
// Label shown on the "exact piece" card: quantity when more than one, else the stud size or family.
function stepLabel({ partNum, qty }: BuildStep) {
  if (qty > 1) return `× ${qty}`;
  const part = getPart(partNum);
  return part.size && part.size.length === 2 ? part.size.join(' × ') : part.family.toUpperCase();
}
function withPiece(step: BuildStep) {
  const piece = describePiece(step.partNum, step.colorId);
  return { ...step, color: piece.color, shape: piece.shape, piece: stepLabel(step), elementId: piece.elementId, officialName: piece.officialName };
}
const builds = [
  { id:'rocket', level:'QUICK BUILD', badge:'#DCF8E9', badgeInk:'#177347', icon:'🚀', title:'Pocket Rocket', detail:'12 pieces · 5 min', steps:[
    {text:'Start with one blue 2 × 4 brick.',hint:'Place it longways. This is the rocket’s strong base.',partNum:'3001',colorId:1,qty:1},
    {text:'Stack a red 2 × 2 brick right in the center.',hint:'Line up the middle studs before you press down.',partNum:'3003',colorId:4,qty:1},
    {text:'Add two thin yellow plates as wings.',hint:'Make both sides match like a mirror.',partNum:'3020',colorId:14,qty:2},
    {text:'Click the white sloped nose on top. Ready for launch!',hint:'Point the smallest end toward the sky.',partNum:'3039',colorId:15,qty:1},
  ].map(withPiece)},
  { id:'dragon', level:'CREATIVE BUILD', badge:'#FFF1C0', badgeInk:'#856300', icon:'🐉', title:'Tiny Brick Dragon', detail:'23 pieces · 12 min', steps:[
    {text:'Build a green sloped base for the dragon’s body.',hint:'The long green slope makes a great backbone.',partNum:'3298',colorId:2,qty:1},
    {text:'Add the blue brick neck and head.',hint:'A little tilt makes your dragon look curious.',partNum:'3004',colorId:1,qty:3},
    {text:'Give your dragon two thin yellow plate wings.',hint:'Try to make the wings even on both sides.',partNum:'3020',colorId:14,qty:2},
    {text:'Finish with a curved red tail and feet.',hint:'Wide feet will help the dragon stand.',partNum:'6091',colorId:4,qty:3},
  ].map(withPiece)},
  { id:'city', level:'MEGA BUILD', badge:'#FFE0E0', badgeInk:'#A52626', icon:'🏙️', title:'Skyline City', detail:'34 pieces · 20 min', steps:[
    {text:'Make a wide blue brick foundation.',hint:'A wide base keeps tall buildings steady.',partNum:'3001',colorId:1,qty:4},
    {text:'Build the red 2 × 2 tower on the left.',hint:'Press each brick firmly before adding the next.',partNum:'3003',colorId:4,qty:8},
    {text:'Build a green sloped tower on the right.',hint:'Try a different height for a fun skyline.',partNum:'3039',colorId:2,qty:4},
    {text:'Add thin yellow plate windows and a curved white rooftop.',hint:'Your city can have any window pattern you like.',partNum:'3023',colorId:14,qty:9},
  ].map(withPiece)},
];
type ModelPiece={color:BrickColor;shape:BrickShape;step:number;x:number;y:number;w:number;h:number;rotate?:number};
const layouts:Record<string,ModelPiece[]>={
  rocket:[
    {color:'blue',shape:'brick',step:1,x:31,y:7,w:18,h:14},{color:'blue',shape:'brick',step:1,x:51,y:7,w:18,h:14},
    {color:'red',shape:'short',step:2,x:40,y:21,w:20,h:37},
    {color:'yellow',shape:'plate',step:3,x:17,y:23,w:27,h:9,rotate:-12},{color:'yellow',shape:'plate',step:3,x:56,y:23,w:27,h:9,rotate:12},
    {color:'white',shape:'slope',step:4,x:41,y:58,w:18,h:22},
  ],
  dragon:[
    {color:'green',shape:'curve',step:1,x:30,y:25,w:43,h:17},{color:'green',shape:'short',step:1,x:35,y:13,w:13,h:11},{color:'green',shape:'short',step:1,x:55,y:13,w:13,h:11},
    {color:'blue',shape:'brick',step:2,x:27,y:41,w:14,h:24,rotate:-8},{color:'blue',shape:'short',step:2,x:14,y:63,w:25,h:17},
    {color:'yellow',shape:'slope',step:3,x:44,y:49,w:32,h:14,rotate:-24},{color:'yellow',shape:'slope',step:3,x:55,y:59,w:28,h:13,rotate:18},
    {color:'red',shape:'curve',step:4,x:69,y:31,w:25,h:10,rotate:-22},{color:'red',shape:'slope',step:4,x:15,y:80,w:8,h:11,rotate:-12},{color:'red',shape:'slope',step:4,x:26,y:80,w:8,h:11,rotate:12},
  ],
  city:[
    {color:'blue',shape:'brick',step:1,x:10,y:7,w:80,h:13},{color:'gray',shape:'axle',step:1,x:18,y:21,w:64,h:5},
    {color:'red',shape:'short',step:2,x:20,y:26,w:24,h:49},
    {color:'green',shape:'slope',step:3,x:57,y:26,w:27,h:35},
    {color:'yellow',shape:'plate',step:4,x:27,y:40,w:10,h:6},{color:'yellow',shape:'plate',step:4,x:27,y:56,w:10,h:6},{color:'yellow',shape:'plate',step:4,x:65,y:39,w:11,h:6},
    {color:'white',shape:'curve',step:4,x:18,y:75,w:28,h:11},{color:'white',shape:'slope',step:4,x:55,y:61,w:31,h:12},
  ],
};

function shapeStyle(shape:BrickShape,placed=false):ViewStyle {
  if(shape==='short')return {width:placed?'72%':27};
  if(shape==='plate')return {height:placed?'38%':14,marginTop:placed?'31%':0};
  if(shape==='slope')return {borderTopLeftRadius:placed?22:16};
  if(shape==='curve')return {borderTopRightRadius:placed?22:18,borderBottomRightRadius:placed?22:18};
  if(shape==='wheel')return {width:placed?'78%':31,height:placed?'78%':31,margin:placed?'11%':0,borderRadius:40,borderWidth:placed?8:7,borderColor:'#28313B',backgroundColor:'#AAB5BF'};
  if(shape==='axle')return {width:placed?'92%':42,height:placed?9:8,marginTop:placed?'42%':0,borderRadius:5};
  return {};
}
function Brick({color,label,shape='brick'}:{color:BrickColor,label?:string,shape?:BrickShape}) {
  const showStuds=shape!=='wheel'&&shape!=='axle';
  return <View style={[s.brick,{backgroundColor:brickColors[color]},shapeStyle(shape)]}>{showStuds&&<><View style={[s.stud,{backgroundColor:brickColors[color],left:7}]}/><View style={[s.stud,{backgroundColor:brickColors[color],right:7}]}/></>}{label&&<Text style={s.brickText}>{label}</Text>}</View>;
}
function Header({home,voiceOn,toggleVoice}:{home:()=>void,voiceOn:boolean,toggleVoice:()=>void}) {
  return <View style={s.header}><Pressable style={s.brand} onPress={home}><View style={s.logo}><View style={[s.logoStud,{left:7}]}/><View style={[s.logoStud,{right:7}]}/></View><Text style={s.brandText}>ALGO</Text></Pressable><View style={s.row}><View style={s.lang}><Text style={s.langText}>EN · FR</Text></View><Pressable style={s.voiceButton} onPress={toggleVoice} accessibilityLabel={voiceOn?'Turn Algo’s voice off':'Turn Algo’s voice on'}><Text style={s.voiceIcon}>{voiceOn?'🔊':'🔇'}</Text></Pressable></View></View>;
}
function Mascot() {
  return <View style={s.mascot} accessibilityLabel="Algo, the friendly building guide"><Text style={[s.spark,{left:8}]}>✦</Text><Text style={[s.spark,{right:0,top:15}]}>✦</Text><View style={s.hair}/><View style={s.head}><View style={s.eyeRow}><View style={s.eye}/><View style={s.eye}/></View><Text style={s.smile}>⌣</Text></View><View style={[s.arm,{left:35,transform:[{rotate:'12deg'}]}]}/><View style={[s.arm,{right:29,transform:[{rotate:'-42deg'}]}]}/><View style={s.body}><View style={s.chest}><Text style={s.chestText}>SL</Text></View></View><View style={[s.leg,{left:54}]}/><View style={[s.leg,{right:54}]}/></View>;
}
function StackModel({buildId,large=false,upto=4}:{buildId:string,large?:boolean,upto?:number}) {
  return <View style={large?s.largeModel:s.miniModel}>{layouts[buildId].filter(piece=>piece.step<=upto).map((piece,index)=>{
    const modelStyle:ViewStyle={position:'absolute',backgroundColor:brickColors[piece.color],left:`${piece.x}%`,bottom:`${piece.y}%`,width:`${piece.w}%`,height:`${piece.h}%`,transform:[{rotate:`${piece.rotate??0}deg`}],borderRadius:piece.shape==='wheel'?50:piece.shape==='curve'?16:piece.shape==='slope'?2:5,borderTopLeftRadius:piece.shape==='slope'?(large?28:9):undefined,borderBottomWidth:large?6:2,borderBottomColor:'rgba(0,0,0,.16)'};
    return <View key={`${piece.color}-${piece.step}-${index}`} style={modelStyle}/>;
  })}</View>;
}
const Back = ({onPress,label='Back'}:{onPress:()=>void,label?:string}) => <Pressable onPress={onPress}><Text style={s.back}>← {label}</Text></Pressable>;
const Primary = ({onPress,children,disabled=false}:{onPress:()=>void,children:string,disabled?:boolean}) => <Pressable style={[s.primary,disabled&&s.disabled]} onPress={onPress} disabled={disabled}><Text style={s.primaryText}>{children}</Text></Pressable>;
const Secondary = ({onPress,children}:{onPress:()=>void,children:string}) => <Pressable style={s.secondary} onPress={onPress}><Text style={s.secondaryText}>{children}</Text></Pressable>;
const Intro = ({label,title,subtitle}:{label:string,title:string,subtitle:string}) => <><Text style={s.stepLabel}>{label}</Text><Text style={s.title}>{title}</Text><Text style={s.subtitle}>{subtitle}</Text></>;

export default function App() {
  const [screen,setScreen]=useState<Screen>('home');
  const [photo,setPhoto]=useState<string|null>(null);
  const [scanning,setScanning]=useState(false);
  const [joke,setJoke]=useState(false);
  const [build,setBuild]=useState(builds[0]);
  const [step,setStep]=useState(0);
  const [hint,setHint]=useState(false);
  const [selectedPiece,setSelectedPiece]=useState(inventory[0]);
  const [board,setBoard]=useState<(typeof inventory[number]|null)[]>(Array(42).fill(null));
  const [creationName,setCreationName]=useState('Alex’s Pocket Rocket');
  const [bookPage,setBookPage]=useState(0);
  const [detectedPieces,setDetectedPieces]=useState(inventory);
  const [scanResult,setScanResult]=useState<VisionResult|null>(null);
  const [voiceOn,setVoiceOn]=useState(isVoiceEnabled());
  useEffect(()=>{say(LINES.greeting,{lineId:'greeting'})},[]);
  function toggleVoice(){const next=!voiceOn;setVoiceEnabled(next);setVoiceOn(next);if(next)say(LINES.greeting,{lineId:'greeting'})}
  const placed=board.filter(Boolean).length;
  const bookPageTotal=build.steps.length+3;
  const go=(next:Screen)=>{setScreen(next);setHint(false)};

  async function takePhoto(){
    const permission=await ImagePicker.requestCameraPermissionsAsync();
    if(!permission.granted){Alert.alert('Camera permission needed','Algo needs permission to photograph your pieces.');return;}
    const result=await ImagePicker.launchCameraAsync({mediaTypes:['images'],allowsEditing:true,quality:.8});
    if(!result.canceled)setPhoto(result.assets[0].uri);
  }
  async function scan(useDemoPhoto=false){
    setScanning(true);
    try {
      const result=await analyzeLegoPhoto({imageUri:useDemoPhoto?'demo://alex-pieces':photo??''});
      setDetectedPieces(result.pieces);
      setScanResult(result);
      go('ideas');
      say(`I found ${result.totalPieces} pieces. Here are three awesome ideas!`);
    } catch(error) {
      const message=error instanceof Error?error.message:'Algo could not scan that photo.';
      Alert.alert('Scanner needs help',message);
    } finally {
      setScanning(false);
    }
  }
  function previewBuild(nextBuild:typeof builds[number]){setBuild(nextBuild);setCreationName(`Alex’s ${nextBuild.title}`);go('preview');say(`Here is the finished ${nextBuild.title}. Take a good look, then we can build it together!`)}
  function startBuild(){setStep(0);go('builder');say(`Let’s build the ${build.title}! ${build.steps[0].text}`,{lineId:`${build.id}-step-1`})}
  function goToStep(next:number){setStep(next);setHint(false);say(build.steps[next].text,{lineId:`${build.id}-step-${next+1}`})}
  function toggleHint(){const next=!hint;setHint(next);if(next)say(build.steps[step].hint,{lineId:`${build.id}-hint-${step+1}`})}
  function finishBuild(){go('complete');say(LINES.complete,{lineId:'complete'})}
  function toggleCell(index:number){setBoard(old=>old.map((value,i)=>i===index?(value?null:selectedPiece):value))}

  return <SafeAreaView style={s.safe}><StatusBar style="dark"/><View style={s.app}><Header home={()=>go('home')} voiceOn={voiceOn} toggleVoice={toggleVoice}/>
    {screen==='home'&&<ScrollView contentContainerStyle={s.page}>
      <View style={s.hero}><Mascot/><View style={s.heroCopy}><Text style={s.heroLabel}>YOUR FRIENDLY AI GUIDE</Text><Text style={s.heroTitle}>Hi! I’m Algo.</Text><Text style={s.heroText}>Show me your pieces, and let’s build something amazing!</Text><Primary onPress={()=>go('scan')}>📸  Scan my pieces</Primary></View></View>
      <View style={s.jokeCard}><Text style={s.jokeBadge}>FRENCH FUN</Text><Text style={s.jokeQuestion}>“Pourquoi les briques sont-elles heureuses?”</Text>{joke?<Text style={s.jokeAnswer}>Parce qu’elles s’emboîtent bien!{`\n`}<Text style={s.translation}>They fit together well!</Text></Text>:<Pressable onPress={()=>{setJoke(true);sayBilingual(LINES['joke-answer-fr'],LINES['joke-answer-en'],'joke-answer')}}><Text style={s.link}>Tell me, Algo!</Text></Pressable>}</View>
      <Pressable onPress={()=>{go('ideas');say(LINES['ideas-demo'],{lineId:'ideas-demo'})}}><Text style={s.demo}>No photo yet? Try Alex’s demo pieces →</Text></Pressable>
    </ScrollView>}

    {screen==='scan'&&<ScrollView contentContainerStyle={s.page}>
      <Back onPress={()=>go('home')}/><Intro label="STEP 1" title="Spread out your pieces" subtitle="Put them in good light so Algo can see every shape and color."/>
      <Pressable style={s.camera} onPress={takePhoto}>{photo?<Image source={{uri:photo}} style={s.photo}/>:<><View style={s.cameraCircle}><Text style={s.cameraEmoji}>📷</Text></View><Text style={s.cameraTitle}>Take a picture</Text><Text style={s.cameraHelp}>with your Android camera</Text></>}</Pressable>
      <Text style={s.privacy}>🔒 Scanner: {visionProvider.displayName}. Photos stay on this phone when an on-device model is selected.</Text><Primary onPress={()=>scan(false)} disabled={!photo}>Find my pieces ✨</Primary><Secondary onPress={()=>scan(true)}>Use demo photo</Secondary>
      {scanning&&<View style={s.overlay}><View style={s.scanLine}/><Text style={s.scanEmoji}>🤖</Text><Text style={s.scanTitle}>Algo is looking…</Text><Text style={s.scanHelp}>Counting shapes and colors with {visionProvider.displayName}</Text></View>}
    </ScrollView>}

    {screen==='ideas'&&<ScrollView contentContainerStyle={s.page}>
      <View style={s.row}><Back onPress={()=>go('scan')} label="Scan again"/><View style={s.pill}><Text style={s.pillText}>{scanResult?.totalPieces??34} pieces found</Text></View></View><Intro label="STEP 2" title="Pick your adventure!" subtitle="Every idea uses only pieces you have."/>
      {scanResult&&<Text style={s.modelNote}>✓ {scanResult.modelName} · processed {scanResult.processingLocation==='device'?'privately on this phone':scanResult.processingLocation}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.inventory}>{detectedPieces.map(item=><View key={`${item.partNum}-${item.colorId}`} style={s.inventoryItem} accessibilityLabel={`${item.count} ${item.name}, part ${item.partNum}`}><Brick color={item.color} shape={item.shape}/><Text style={s.count}>{item.count}</Text></View>)}</ScrollView>
      {builds.map(item=><Pressable key={item.id} style={s.design} onPress={()=>previewBuild(item)}><Text style={[s.badge,{backgroundColor:item.badge,color:item.badgeInk}]}>{item.level}</Text><View style={s.designIcon}><StackModel buildId={item.id}/></View><View style={{flex:1}}><Text style={s.designTitle}>{item.title}</Text><Text style={s.designDetail}>{item.detail}</Text></View><Text style={s.arrow}>→</Text></Pressable>)}
      <Pressable style={s.creatorCard} onPress={()=>go('creator')}><View style={s.plusBlock}><Text style={s.plus}>+</Text></View><View><Text style={s.designTitle}>Create My Own</Text><Text style={s.designDetail}>Invent anything you imagine</Text></View></Pressable>
      <Secondary onPress={()=>{say(LINES['new-ideas'],{lineId:'new-ideas'});Alert.alert('Voilà!','Algo made three fresh ideas!')}}>↻ Make three new designs</Secondary>
    </ScrollView>}

    {screen==='preview'&&<ScrollView contentContainerStyle={s.page}>
      <Back onPress={()=>go('ideas')} label="All ideas"/><Intro label="FINAL CREATION" title={build.title} subtitle="This is what you’ll build with the pieces Algo found."/>
      <View style={s.finalCard}><Text style={s.finishedBadge}>FINISHED MODEL</Text><StackModel buildId={build.id} large/><Text style={s.rotate}>↔ Swipe to look around</Text></View>
      <View style={s.readyCard}><View style={s.readyCheck}><Text style={s.readyCheckText}>✓</Text></View><View><Text style={s.readyTitle}>You have every piece!</Text><Text style={s.readyDetail}>{build.detail}</Text></View></View>
      <Primary onPress={startBuild}>Build it step by step →</Primary><Secondary onPress={()=>go('ideas')}>Choose a different design</Secondary>
    </ScrollView>}

    {screen==='builder'&&<ScrollView contentContainerStyle={s.page}>
      <View style={s.row}><Back onPress={()=>go('ideas')} label="Ideas"/><View style={s.pill}><Text style={s.pillText}>Step {step+1} of {build.steps.length}</Text></View></View><Text style={s.title}>{build.title}</Text>
      <View style={s.topPanel}><View style={s.panelHead}><Text style={s.panelLabel}>EXACT PIECE</Text><Text style={s.panelCount}>{Math.max(0,12-step*3)} LEFT</Text></View><View style={s.needed}><Brick color={build.steps[step].color} shape={build.steps[step].shape} label={build.steps[step].piece}/></View><Text style={s.partId}>{build.steps[step].officialName} · part {build.steps[step].partNum}</Text></View>
      <View style={s.bottomPanel}><View style={s.panelHead}><Text style={s.panelLabel}>BUILD STEP</Text><Pressable style={s.hintButton} onPress={toggleHint}><Text style={s.hintButtonText}>💡 Hint</Text></Pressable></View>
        <View style={s.buildStage}><StackModel buildId={build.id} large upto={step+1}/><Text style={s.rotate}>↔ Swipe to look around</Text></View>
        <Text style={s.instruction}>{build.steps[step].text}</Text>{hint&&<Text style={s.hintText}>Algo says: “{build.steps[step].hint}”</Text>}
        <View style={s.buildButtons}><Pressable style={[s.smallSecondary,step===0&&s.disabled]} disabled={step===0} onPress={()=>goToStep(step-1)}><Text style={s.secondaryText}>← Back</Text></Pressable><Pressable style={s.smallPrimary} onPress={()=>step===build.steps.length-1?finishBuild():goToStep(step+1)}><Text style={s.primaryText}>{step===build.steps.length-1?'I’m finished! ✓':'Piece added ✓'}</Text></Pressable></View>
      </View>
    </ScrollView>}

    {screen==='creator'&&<ScrollView contentContainerStyle={s.page}>
      <View style={s.row}><Back onPress={()=>go('ideas')} label="Ideas"/><Pressable onPress={()=>setBoard(Array(42).fill(null))}><Text style={s.link}>Clear</Text></Pressable></View><Intro label="CREATOR MODE" title="Build your own!" subtitle="Choose a piece, then tap the board to place it."/>
      <View style={s.topPanel}><View style={s.panelHead}><Text style={s.panelLabel}>SHAPES &amp; COLORS</Text><Text style={s.panelCount}>{Math.max(0,(scanResult?.totalPieces??34)-placed)} LEFT</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.palette}>{detectedPieces.map(item=><Pressable key={`${item.partNum}-${item.colorId}`} accessibilityLabel={`${item.name}, part ${item.partNum}`} style={[s.palettePiece,selectedPiece.partNum===item.partNum&&selectedPiece.colorId===item.colorId&&s.selected]} onPress={()=>setSelectedPiece(item)}><Brick color={item.color} shape={item.shape}/><Text style={s.count}>{item.count}</Text></Pressable>)}</ScrollView></View>
      <View style={s.bottomPanel}><View style={s.panelHead}><Text style={s.panelLabel}>YOUR CREATION</Text><Text style={s.panelCount}>{placed} PLACED</Text></View><View style={s.board}>{board.map((piece,i)=><Pressable key={i} style={s.cell} onPress={()=>toggleCell(i)}>{piece&&<View style={[s.placed,{backgroundColor:brickColors[piece.color]},shapeStyle(piece.shape,true)]}/>}</Pressable>)}</View><Text style={s.creatorMessage}>Algo says: “{LINES['creator-welcome']}”</Text><Primary disabled={placed<3} onPress={()=>{setCreationName('Alex’s Amazing Invention');go('complete');say(LINES['invention-complete'],{lineId:'invention-complete'})}}>Finish my creation</Primary></View>
    </ScrollView>}

    {screen==='complete'&&<ScrollView contentContainerStyle={[s.page,s.complete]}>
      <View style={s.check}><Text style={s.checkText}>✓</Text></View><Intro label="MAGNIFIQUE!" title="You built it!" subtitle="Give your amazing creation a name."/><TextInput style={s.nameInput} value={creationName} onChangeText={setCreationName} maxLength={40}/>
      <View style={s.book}><Text style={s.bookOverline}>MY BUILD BOOK</Text><Text style={s.bookTitle}>{creationName}</Text><Text style={s.bookIcon}>{creationName.includes('Invention')?'✨':build.icon}</Text><Text style={s.bookFooter}>Designed with Algo</Text></View>
      <Primary onPress={()=>{setBookPage(0);go('book');say(LINES['book-ready'],{lineId:'book-ready'})}}>📖  Make my instruction book</Primary><Secondary onPress={()=>go('ideas')}>Build something else</Secondary><Text style={s.adult}>A grown-up will help with printing, payment, and delivery.</Text>
    </ScrollView>}

    {screen==='book'&&<ScrollView contentContainerStyle={s.page}>
      <View style={s.row}><Back onPress={()=>go('complete')} label="Finished build"/><View style={s.pill}><Text style={s.pillText}>BOOK PREVIEW</Text></View></View><Intro label="MADE BY YOU" title="My instruction book" subtitle="Turn the pages to see your whole build story."/>
      <View style={s.bookViewer}>
        {bookPage===0&&<View style={[s.bookPage,s.bookPageCover]}><Text style={s.coverOverline}>MY BUILD BOOK</Text><Text style={s.coverTitle}>{creationName}</Text><StackModel buildId={build.id} large/><Text style={s.coverCopy}>Designed and built with Algo</Text></View>}
        {bookPage===1&&<View style={s.bookPage}><Text style={s.pageOverline}>BEFORE YOU BUILD</Text><Text style={s.pageTitle}>Shapes and colors you’ll need</Text><View style={s.bookInventory}>{detectedPieces.map(item=><View key={`${item.partNum}-${item.colorId}`} style={s.inventoryItem}><Brick color={item.color} shape={item.shape}/><Text style={s.count}>{item.count}</Text></View>)}</View><Text style={s.pageCopy}>Match the exact shape, size, and color before each step.</Text><Text style={s.partList}>{detectedPieces.map(item=>`${item.count} × ${item.partNum}`).join('  ·  ')}</Text></View>}
        {bookPage>=2&&bookPage<build.steps.length+2&&(()=>{const bookStep=build.steps[bookPage-2];return <View style={s.bookPage}><View style={s.pageNumber}><Text style={s.pageNumberText}>{bookPage-1}</Text></View><Text style={s.pageOverline}>BUILD STEP {bookPage-1}</Text><Text style={s.pageTitle}>{bookStep.text}</Text><StackModel buildId={build.id} large upto={bookPage-1}/><Text style={s.pageCopy}>Algo’s hint: {bookStep.hint}</Text></View>})()}
        {bookPage===bookPageTotal-1&&<View style={s.bookPage}><Text style={s.pageOverline}>MAGNIFIQUE!</Text><Text style={s.pageTitle}>You did it!</Text><StackModel buildId={build.id} large/><Text style={s.pageCopy}>This creation was built by {creationName}. Keep imagining, building, and having fun!</Text></View>}
      </View>
      <Text style={s.pageCounter}>Page {bookPage+1} of {bookPageTotal}</Text><View style={s.buildButtons}><Pressable style={[s.smallSecondary,bookPage===0&&s.disabled]} disabled={bookPage===0} onPress={()=>setBookPage(bookPage-1)}><Text style={s.secondaryText}>← Previous</Text></Pressable><Pressable style={s.smallPrimary} onPress={()=>setBookPage(bookPage===bookPageTotal-1?0:bookPage+1)}><Text style={s.primaryText}>{bookPage===bookPageTotal-1?'Back to cover ↻':'Next page →'}</Text></Pressable></View>
      <Secondary onPress={()=>Alert.alert('Printing comes next','A grown-up will help save and print this book in a later version.')}>🖨️ Print with a grown-up</Secondary>
    </ScrollView>}
  </View></SafeAreaView>;
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:C.paper},app:{flex:1,width:'100%',maxWidth:560,alignSelf:'center',backgroundColor:C.paper},header:{height:66,paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},voiceButton:{marginLeft:8,width:36,height:36,alignItems:'center',justifyContent:'center',borderRadius:18,backgroundColor:C.white,elevation:2},voiceIcon:{fontSize:17},page:{paddingHorizontal:18,paddingBottom:42},
  brand:{flexDirection:'row',alignItems:'center',gap:9},brandText:{color:C.dark,fontSize:25,fontWeight:'900',letterSpacing:1},logo:{width:37,height:25,borderRadius:5,backgroundColor:C.blue,borderBottomWidth:5,borderBottomColor:'#075AAF'},logoStud:{position:'absolute',top:-6,width:11,height:7,borderTopLeftRadius:5,borderTopRightRadius:5,backgroundColor:'#3198FF'},lang:{paddingHorizontal:10,paddingVertical:7,backgroundColor:C.white,borderRadius:14,elevation:2},langText:{color:C.dark,fontSize:11,fontWeight:'900'},
  hero:{minHeight:535,borderRadius:30,overflow:'hidden',backgroundColor:C.blue,padding:24,justifyContent:'flex-end',elevation:8},heroCopy:{alignItems:'center'},heroLabel:{color:C.yellow,fontSize:11,fontWeight:'900',letterSpacing:1.4},heroTitle:{color:C.white,fontSize:42,lineHeight:50,fontWeight:'900'},heroText:{maxWidth:330,marginBottom:6,color:C.white,fontSize:17,lineHeight:24,textAlign:'center',fontWeight:'700'},
  primary:{width:'100%',minHeight:56,padding:14,marginTop:12,alignItems:'center',justifyContent:'center',borderRadius:16,backgroundColor:C.yellow,borderBottomWidth:5,borderBottomColor:'#D6A900',elevation:3},primaryText:{color:'#29323C',fontSize:16,fontWeight:'900'},secondary:{width:'100%',minHeight:52,padding:13,marginTop:11,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#CFE2F3',borderRadius:16,backgroundColor:C.white},secondaryText:{color:C.dark,fontWeight:'900'},disabled:{opacity:.38},
  mascot:{position:'absolute',top:28,left:'50%',width:240,height:280,marginLeft:-120},spark:{position:'absolute',top:35,color:C.yellow,fontSize:30,fontWeight:'900'},hair:{position:'absolute',zIndex:6,top:35,left:77,width:87,height:37,borderRadius:20,backgroundColor:'#F2CF3C',borderBottomWidth:6,borderBottomColor:'#D9AD20',transform:[{rotate:'-4deg'}]},head:{position:'absolute',zIndex:5,top:48,left:83,width:74,height:70,borderRadius:15,backgroundColor:'#FFD48A',borderBottomWidth:6,borderBottomColor:'#E7AD58'},eyeRow:{marginTop:29,paddingHorizontal:15,flexDirection:'row',justifyContent:'space-between'},eye:{width:12,height:12,borderRadius:6,borderWidth:3,borderColor:C.white,backgroundColor:'#1F8CFF'},smile:{marginTop:-1,color:'#A64B40',fontSize:25,lineHeight:22,textAlign:'center',fontWeight:'900'},body:{position:'absolute',zIndex:3,top:111,left:69,width:103,height:91,alignItems:'center',backgroundColor:'#0B69CF',borderBottomWidth:9,borderBottomColor:'#084D98',borderRadius:8},chest:{width:40,height:40,marginTop:21,alignItems:'center',justifyContent:'center',borderRadius:20,borderWidth:3,borderColor:C.white},chestText:{color:C.white,fontWeight:'900'},arm:{position:'absolute',zIndex:2,top:120,width:35,height:87,borderRadius:12,backgroundColor:'#0B69CF'},leg:{position:'absolute',zIndex:2,top:194,width:44,height:64,borderRadius:8,backgroundColor:'#123E76',borderBottomWidth:8,borderBottomColor:'#0B294E'},
  jokeCard:{marginTop:20,padding:18,alignItems:'center',borderWidth:2,borderColor:'#D6E8F6',borderRadius:19,backgroundColor:C.white},jokeBadge:{marginTop:-30,marginBottom:9,paddingHorizontal:11,paddingVertical:3,borderRadius:12,backgroundColor:'#FFF0F0',color:'#C63434',fontSize:10,fontWeight:'900'},jokeQuestion:{color:C.ink,textAlign:'center',fontWeight:'800'},link:{padding:8,color:C.dark,fontWeight:'900'},jokeAnswer:{marginTop:8,color:C.green,textAlign:'center',fontWeight:'900'},translation:{color:C.gray,fontSize:12},demo:{padding:14,color:C.dark,textAlign:'center',fontWeight:'800'},
  back:{paddingVertical:9,color:C.dark,fontWeight:'900'},stepLabel:{marginTop:8,color:C.blue,fontSize:11,fontWeight:'900',letterSpacing:1.4,textAlign:'center'},title:{color:C.ink,fontSize:34,lineHeight:42,textAlign:'center',fontWeight:'900'},subtitle:{marginTop:5,marginBottom:18,color:C.gray,fontSize:15,lineHeight:21,textAlign:'center',fontWeight:'600'},
  camera:{height:330,alignItems:'center',justifyContent:'center',overflow:'hidden',borderWidth:3,borderStyle:'dashed',borderColor:'#7DB7DF',borderRadius:27,backgroundColor:'#EAF7FF'},cameraCircle:{width:93,height:93,alignItems:'center',justifyContent:'center',borderRadius:47,backgroundColor:C.blue,elevation:6},cameraEmoji:{fontSize:40},cameraTitle:{marginTop:13,color:C.dark,fontSize:23,fontWeight:'900'},cameraHelp:{marginTop:2,color:C.gray},photo:{width:'100%',height:'100%'},privacy:{marginTop:8,color:C.gray,fontSize:11,textAlign:'center'},overlay:{position:'absolute',top:0,right:0,bottom:0,left:0,zIndex:20,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(5,55,107,.95)'},scanLine:{width:235,height:6,marginBottom:30,borderRadius:4,backgroundColor:C.yellow},scanEmoji:{fontSize:55},scanTitle:{marginTop:10,color:C.white,fontSize:24,fontWeight:'900'},scanHelp:{marginTop:5,color:'#BCE3FF'},
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},pill:{paddingHorizontal:10,paddingVertical:7,borderRadius:15,backgroundColor:C.pale},pillText:{color:C.dark,fontSize:11,fontWeight:'900'},modelNote:{marginTop:-9,marginBottom:7,color:'#177347',fontSize:10,textAlign:'center',fontWeight:'800'},inventory:{paddingVertical:6,gap:8},inventoryItem:{minWidth:68,height:64,padding:9,flexDirection:'row',alignItems:'flex-end',justifyContent:'center',gap:7,borderRadius:14,backgroundColor:C.white,elevation:2},count:{color:C.ink,fontSize:11,fontWeight:'900'},brick:{position:'relative',width:40,height:29,alignItems:'center',justifyContent:'center',borderRadius:4,borderBottomWidth:5,borderBottomColor:'rgba(0,0,0,.15)'},stud:{position:'absolute',top:-6,width:10,height:7,borderTopLeftRadius:5,borderTopRightRadius:5},brickText:{color:C.ink,fontSize:8,fontWeight:'900'},
  design:{position:'relative',minHeight:122,marginTop:12,paddingHorizontal:13,paddingTop:29,paddingBottom:12,flexDirection:'row',alignItems:'center',gap:11,borderRadius:22,backgroundColor:C.white,elevation:4},badge:{position:'absolute',top:9,left:13,paddingHorizontal:9,paddingVertical:3,borderRadius:10,fontSize:9,fontWeight:'900',letterSpacing:.7},designIcon:{width:82,height:72,alignItems:'center',justifyContent:'center',borderRadius:16,backgroundColor:'#E8F5FF',overflow:'hidden'},designTitle:{color:C.ink,fontSize:18,fontWeight:'900'},designDetail:{marginTop:5,color:C.gray,fontSize:12},arrow:{color:C.blue,fontSize:22,fontWeight:'900'},creatorCard:{minHeight:100,marginTop:12,padding:15,flexDirection:'row',alignItems:'center',gap:16,borderWidth:3,borderStyle:'dashed',borderColor:'#5FA2D5',borderRadius:22,backgroundColor:'#EEF9FF'},plusBlock:{width:62,height:57,alignItems:'center',justifyContent:'center',borderRadius:9,backgroundColor:C.blue,borderBottomWidth:6,borderBottomColor:C.dark},plus:{color:C.white,fontSize:36,lineHeight:40},
  miniModel:{position:'relative',width:78,height:67},largeModel:{position:'relative',width:250,height:235},stackBrick:{position:'absolute',borderRadius:5,borderBottomWidth:5,borderBottomColor:'rgba(0,0,0,.16)',elevation:3},finalCard:{position:'relative',height:365,alignItems:'center',justifyContent:'center',overflow:'hidden',borderRadius:28,backgroundColor:'#E0F3FF',elevation:5},finishedBadge:{position:'absolute',zIndex:2,top:15,left:15,paddingHorizontal:10,paddingVertical:5,borderRadius:12,backgroundColor:C.white,color:C.dark,fontSize:10,fontWeight:'900',letterSpacing:.8},readyCard:{marginTop:13,padding:14,flexDirection:'row',alignItems:'center',gap:12,borderRadius:17,backgroundColor:'#E7F9EF'},readyCheck:{width:36,height:36,alignItems:'center',justifyContent:'center',borderRadius:18,backgroundColor:C.green},readyCheckText:{color:C.white,fontSize:21,fontWeight:'900'},readyTitle:{color:'#17623E',fontWeight:'900'},readyDetail:{marginTop:2,color:'#4D7A65',fontSize:12},
  topPanel:{marginTop:15,padding:13,borderWidth:2,borderColor:'#D7E8F5',borderRadius:18,backgroundColor:'#F4FAFF'},bottomPanel:{marginTop:12,padding:15,borderRadius:23,backgroundColor:C.white,elevation:5},panelHead:{minHeight:30,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},panelLabel:{color:C.ink,fontSize:11,fontWeight:'900',letterSpacing:.7},panelCount:{color:C.dark,fontSize:11,fontWeight:'900'},partId:{marginTop:8,color:C.gray,fontSize:11,textAlign:'center',fontWeight:'800'},partList:{marginTop:10,color:C.gray,fontSize:10,textAlign:'center'},needed:{height:58,alignItems:'center',justifyContent:'center'},hintButton:{paddingHorizontal:9,paddingVertical:6,borderRadius:12,backgroundColor:'#FFF4C3'},hintButtonText:{color:'#725900',fontSize:11,fontWeight:'900'},buildStage:{position:'relative',height:260,alignItems:'center',justifyContent:'center',overflow:'hidden',borderRadius:18,backgroundColor:'#E5F5FF'},modelBrick:{position:'absolute',height:37,borderRadius:6,borderBottomWidth:7,borderBottomColor:'rgba(0,0,0,.15)',elevation:4},rotate:{position:'absolute',bottom:8,color:C.gray,fontSize:10},instruction:{minHeight:58,padding:12,color:C.ink,lineHeight:21,textAlign:'center',fontWeight:'900'},hintText:{padding:10,borderRadius:12,backgroundColor:'#FFF8D9',color:'#6C5500',textAlign:'center',fontSize:12,fontWeight:'700'},buildButtons:{flexDirection:'row',gap:10},smallSecondary:{flex:1,minHeight:53,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#CFE2F3',borderRadius:15},smallPrimary:{flex:1.5,minHeight:53,alignItems:'center',justifyContent:'center',borderRadius:15,backgroundColor:C.yellow,borderBottomWidth:5,borderBottomColor:'#D6A900'},
  palette:{paddingVertical:5,gap:8},palettePiece:{minWidth:66,height:64,padding:7,flexDirection:'row',alignItems:'flex-end',justifyContent:'center',gap:5,borderWidth:3,borderColor:'transparent',borderRadius:14,backgroundColor:C.white},selected:{borderColor:C.blue},board:{flexDirection:'row',flexWrap:'wrap',padding:6,borderRadius:16,backgroundColor:'#D7E1E9'},cell:{width:'16.666%',aspectRatio:1,padding:4,borderWidth:1,borderColor:'rgba(255,255,255,.28)'},placed:{width:'100%',height:'100%',borderRadius:4,borderBottomWidth:5,borderBottomColor:'rgba(0,0,0,.16)',elevation:3},creatorMessage:{minHeight:42,paddingTop:11,color:C.dark,textAlign:'center',fontSize:12,fontWeight:'800'},
  complete:{alignItems:'center'},check:{width:86,height:86,marginTop:15,marginBottom:12,alignItems:'center',justifyContent:'center',borderWidth:7,borderColor:C.white,borderRadius:43,backgroundColor:C.green,elevation:6},checkText:{color:C.white,fontSize:50,lineHeight:58,fontWeight:'900'},nameInput:{width:'100%',marginVertical:16,padding:14,borderWidth:2,borderColor:'#BDD8EC',borderRadius:14,backgroundColor:C.white,color:C.ink,fontWeight:'900'},book:{width:190,height:246,padding:18,alignItems:'center',borderTopRightRadius:13,borderBottomRightRadius:13,backgroundColor:C.dark,borderLeftWidth:9,borderLeftColor:'#063D78',elevation:9},bookOverline:{color:C.white,fontSize:9,fontWeight:'900',letterSpacing:1},bookTitle:{marginTop:10,color:C.white,fontSize:21,textAlign:'center',fontWeight:'900'},bookIcon:{marginTop:17,fontSize:66},bookFooter:{marginTop:'auto',color:C.white,fontSize:10},adult:{marginTop:12,color:C.gray,fontSize:10,textAlign:'center'},
  bookViewer:{padding:16,borderRadius:26,backgroundColor:'#D6E8F5'},bookPage:{minHeight:480,padding:22,alignItems:'center',justifyContent:'center',borderTopRightRadius:15,borderBottomRightRadius:15,backgroundColor:'#FFFDF7',borderLeftWidth:8,borderLeftColor:'#E8E4D9',elevation:5},bookPageCover:{backgroundColor:C.dark,borderLeftColor:'#063D78'},coverOverline:{color:C.yellow,fontSize:10,fontWeight:'900',letterSpacing:1.3},coverTitle:{marginTop:10,maxWidth:300,color:C.white,fontSize:30,textAlign:'center',fontWeight:'900'},coverCopy:{color:C.white,textAlign:'center',fontWeight:'700'},pageOverline:{marginTop:8,color:C.blue,fontSize:10,fontWeight:'900',letterSpacing:1.2},pageTitle:{marginVertical:9,maxWidth:300,color:C.ink,fontSize:28,lineHeight:34,textAlign:'center',fontWeight:'900'},pageCopy:{maxWidth:310,color:C.gray,lineHeight:20,textAlign:'center',fontWeight:'700'},bookInventory:{marginVertical:20,flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:10},pageNumber:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:22,backgroundColor:C.blue},pageNumberText:{color:C.white,fontSize:22,fontWeight:'900'},pageCounter:{padding:12,color:C.gray,textAlign:'center',fontSize:12,fontWeight:'800'},
});
