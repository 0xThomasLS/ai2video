import { DEFAULT_OPTIONS, OpenAI2Video, OpenAI2VideoError } from "./index.js"
import "dotenv/config"

class StopExecution {
  constuctor(tag) {
    this.tag = tag
  }

  get tag() {
    return this.tag
  }

  toString() {
    console.error(`Stop execution due to '${this.tag}'`)
  }
}

main()


async function main() {
  console.time('main')

  try {
    // Initialize
    const args = parseArgv()
    const maker = new OpenAI2Video({
      openAIApiKey: args.openAIApiKey,
      mistralApiKey: args.mistralApiKey,
      aspect: args.aspect,
      retry: args.retry,
      intermadiateFolder: args.intermadiate,
      lang: args.lang,
      backgroundMusicVolume: args.backgroundMusicVolume,
      voice: args.voice,
      models: {
        chat: args.chatModel,
        image: args.imageModel,
        audio: args.audioModel,
      },
      image: {
        style: args.imageStyle,
        quality: args.imageQuality
      }
    })

    // Load input
    if (args.search)          maker.fromSearch(args.search)
    if (args.searchFile)      maker.fromSearchFile(args.searchFile)
    if (args.story)           maker.fromStory(args.story)
    if (args.storyFile)       maker.fromStoryFile(args.storyFile)
    if (args.highlights)      maker.fromHighlights(args.highlights)
    if (args.highlightsFile)  maker.fromHighlightsFile(args.highlightsFile)

    // Add title screen
    if (args.titleScreenText)         maker.addTitleScreenText(args.titleScreenText)
    if (args.titleScreenBlur)         maker.addTitleScreenBlur(args.titleScreenBlur)
    if (args.titleScreenMargin)       maker.addTitleScreenMargin(args.titleScreenMargin)
    if (args.titleScreenFontSize)     maker.addTitleScreenFontSize(args.titleScreenFontSize)
    if (args.titleScreenFontFamily)   maker.addTitleScreenFontFamily(args.titleScreenFontFamily)

    // Add background music
    if (args.backgroundMusic) maker.addBackgroundMusicList(args.backgroundMusic.substring(0, 1) === '[' ? JSON.parse(args.backgroundMusic) : [ args.backgroundMusic ])

    // Add intermadiate
    if (args.addImageDesc)        maker.addImagesDescription(args.addImageDesc)
    if (args.addImageDescFile)    maker.addImagesDescriptionFile(args.addImageDescFile)
    if (args.addSpeechsDesc)      maker.addSpeechsDescription(args.addSpeechsDesc)
    if (args.addSpeechsDescFile)  maker.addSpeechsDescriptionFile(args.addSpeechsDescFile)

    // Generate intermadiates files
    if (args.outputStory)           await maker.toStory(args.outputStory)
    if (args.translateHighlights)   await maker.translateHighlights(args.translateHighlights, args.outputHighlights)
    else if (args.outputHighlights) await maker.toHighlights(args.outputHighlights)
    if (args.outputImages)          await maker.toImages(args.outputImages)

    // Generate final files
    if (args.outputAudio && args.outputVideo) await maker.toAudioAndVideo(args.outputAudio, args.outputVideo, args.outputAudioDescFile)
    else if (args.outputAudio)                await maker.toAudio(args.outputAudio, args.outputAudioDescFile)
    else if (args.outputVideo)                await maker.toVideo(args.outputVideo)

    console.log('Finished!')
  } catch (e) {
    if (!(e instanceof StopExecution)) {
      console.error(e)
    }
  }

  console.timeEnd('main')
}

function parseArgv() {
  // Get all arguments
  const ARG_PREFIX = '--'
  const args = {}
  for (let i=2; i<process.argv.length; i++) {
    if (process.argv[i].substring(0, ARG_PREFIX.length) === ARG_PREFIX) {
      let completeArg = process.argv[i].substring(ARG_PREFIX.length).split('=')
      args[completeArg[0]] = completeArg.length > 1 ? completeArg[1] : true
      
      if (completeArg[0] === 'help') {
        break
      }
    }
  }

  // Define default argument values
  const defaultArgs = {
    openAIApiKey: process.env.OPEN_AI_API_KEY,
    mistralApiKey: process.env.MISTRAL_API_KEY
  }

  if (args.help) {
    console.log('Usage: node cmd.js [arguments]')
    console.log("\nOptions:")
    console.log("\t--help\t\t\t\tOpen documentation for this node script")
    console.log("\t--apiKey=...\t\t\tOpenAI API key")
    console.log(`\t--intermadiate=...\t\t\Intermadiate folder for intermediate generation (default: ${DEFAULT_OPTIONS.INTERMADIATE_FOLDER})`)
    console.log(`\t--lang=...\t\t\tDefine default language (default: ${DEFAULT_OPTIONS.LANGUAGE})`)
    console.log(`\t--retry=...\t\t\tNumber of retry (default: ${DEFAULT_OPTIONS.RETRY}) when error occured`)
    console.log(`\t--aspect=...\t\t\tVideo aspect output (square, vertical, horizontal, default: ${DEFAULT_OPTIONS.VIDEO_ASPECT})`)
    console.log("\t--backgroundMusic=...\t\tPath or Array of path for background music")
    console.log(`\t--backgroundMusicVolume=...\tVolume of background music (float between 0 to 1, default: ${DEFAULT_OPTIONS.BACKGROUND_MUSIC_VOLUME})`)
    console.log("\t--titleScreenText=...\t\tAdd title screen")
    console.log(`\t--titleScreenBlur=...\t\tSet blur for title panel (default: ${DEFAULT_OPTIONS.TITLE_BLUR})`)
    console.log(`\t--titleScreenMargin=...\t\tSet margin for title panel (default: ${DEFAULT_OPTIONS.TITLE_MARGIN})`)
    console.log(`\t--titleScreenFontSize=...\tSet font size for title (default: ${DEFAULT_OPTIONS.TITLE_FONT_SIZE})`)
    console.log(`\t--titleScreenFontFamily=...\tSet font family for title (default: ${DEFAULT_OPTIONS.TITLE_FONT_FAMILY})`)
    console.log(`\t--chatModel=...\t\t\tOpenAI model (default: ${DEFAULT_OPTIONS.CHAT_MODEL}) used for chat (rewrite story, highlight...)`)
    console.log(`\t--imageModel=...\t\tImage generation AI model (default: ${DEFAULT_OPTIONS.IMAGE_MODEL})`)
    console.log(`\t--imageStyle=...\t\tImage generation style (default: ${DEFAULT_OPTIONS.IMAGE_STYLE}, only for dall-e-3 model)`)
    console.log(`\t--imageQuality=...\t\tImage generation quality (default: ${DEFAULT_OPTIONS.IMAGE_QUALITY})`)
    console.log(`\t--audioModel=...\t\tOpenAI model (default: ${DEFAULT_OPTIONS.AUDIO_MODEL}) used for generate speech`)
    console.log(`\t--voice=...\t\t\tVoice (default: ${DEFAULT_OPTIONS.VOICE}) used for generate speech`)
    console.log("\t--search=...\t\t\tAsk GPT to generate the base story use to generate video")
    console.log("\t--searchFile=...\t\tFilepath to generate new search")
    console.log("\t--story=...\t\t\tStory use to generate video")
    console.log("\t--storyFile=...\t\t\tStory file use to generate video")
    console.log("\t--highlights=...\t\tLoad highlights")
    console.log("\t--highlightsFile=...\t\tLoad highlights from file")
    console.log("\t--translateHighlights=...\tSet language to translate highlights content")
    console.log("\t--addImageDesc=...\t\tAdd image description")
    console.log("\t--addImageDescFile=...\t\tAdd image description file")
    console.log("\t--addSpeechsDesc=...\t\tAdd speechs description")
    console.log("\t--addSpeechsDescFile=...\tAdd speechs description file")
    console.log("\t--outputStory=...\t\tStory output path")
    console.log("\t--outputHighlights=...\t\tHighlights description file path")
    console.log("\t--outputImages=...\t\tImages description file path")
    console.log(`\t--outputVideo=...\t\tVideo output path (default: ${defaultArgs.outputVideo})`)
    console.log(`\t--outputAudio=...\t\tAudio output path (default: ${defaultArgs.outputAudio})`)
    console.log("\t--outputAudioDescFile=...\tAudio description file path")
    throw new StopExecution('help')
  }

  if (!args.openAIApiKey) args.openAIApiKey = defaultArgs.openAIApiKey
  if (!args.mistralApiKey) args.mistralApiKey = defaultArgs.mistralApiKey

  return args
}