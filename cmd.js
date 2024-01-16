import { DEFAULT_OPTIONS, OpenAI2Video, OpenAI2VideoError } from "./index.js"
import "dotenv/config"

main()


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

async function main() {
  try {
    const args = parseArgv()
    const openAI2VideoOpts = {
      openAIApiKey: args.apiKey,
      aspect: args.aspect,
      retry: args.retry,
      temporaryFolder: args.tmp,
      backgroundMusicVolume: args.backgroundMusicVolume,
      voice: args.voice,
      models: {
        chat: args.chatModel,
        image: args.imageModel,
        audio: args.audioModel,
      },
      image: {
        style: args.imageStyle
      }
    }

    // Initialize
    const maker = new OpenAI2Video(openAI2VideoOpts)

    // Load input
    if (args.search)          maker.fromSearch(args.search)
    if (args.searchFile)      maker.fromSearchFile(args.searchFile)
    if (args.story)           maker.fromStory(args.story)
    if (args.storyFile)       maker.fromStoryFile(args.storyFile)
    if (args.highlights)      maker.fromHighlights(args.highlights)
    if (args.highlightsFile)  maker.fromHighlightsFile(args.highlightsFile)

    // Add background music
    if (args.backgroundMusic) maker.addBackgroundMusicList(args.backgroundMusic.substring(0, 1) === '[' ? JSON.parse(args.backgroundMusic) : [ args.backgroundMusic ])

    // Add intermadiate
    if (args.addImageDesc)        maker.addImagesDescription(args.addImageDesc)
    if (args.addImageDescFile)    maker.addImagesDescriptionFile(args.addImageDescFile)
    if (args.addSpeechsDesc)      maker.addSpeechsDescription(args.addSpeechsDesc)
    if (args.addSpeechsDescFile)  maker.addSpeechsDescriptionFile(args.addSpeechsDescFile)

    // Generate
    if (args.outputHighlights)                await maker.toHighlights(args.outputHighlights)
    if (args.outputImages)                    await maker.toImages(args.outputImages)
    if (args.outputAudio && args.outputVideo) await maker.toAudioAndVideo(args.outputAudio, args.outputVideo)
    else if (args.outputAudio)                await maker.toAudio(args.outputAudio)
    else if (args.outputVideo)                await maker.toVideo(args.outputVideo)

    console.log('Finished!')
  } catch (e) {
    console.error(e)
    if (!e instanceof StopExecution) {
      console.error(e)
    }
  }
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
    apiKey: process.env.OPEN_AI_API_KEY
  }

  if (args.help) {
    console.log('Usage: node cmd.js [arguments]')
    console.log("\nOptions:")
    console.log("\t--help\t\t\t\tOpen documentation for this node script")
    console.log("\t--apiKey=...\t\t\tOpenAI API key")
    console.log(`\t--tmp=...\t\t\tTemporary folder for intermediate generation`)
    console.log(`\t--retry=...\t\t\tNumber of retry (default: ${DEFAULT_OPTIONS.RETRY}) when error occured`)
    console.log(`\t--aspect=...\t\t\tVideo aspect output (square, vertical, horizontal, default: ${DEFAULT_OPTIONS.VIDEO_ASPECT})`)
    console.log("\t--outputHighlights=...\t\tHighlights output path")
    console.log("\t--outputImages=...\t\tImages output path")
    console.log(`\t--outputVideo=...\t\tVideo output path (default: ${defaultArgs.outputVideo})`)
    console.log(`\t--outputAudio=...\t\tAudio output path (default: ${defaultArgs.outputAudio})`)
    console.log(`\t--chatModel=...\t\t\tOpenAI model (default: ${DEFAULT_OPTIONS.CHAT_MODEL}) used for chat (rewrite story, highlight...)`)
    console.log(`\t--imageModel=...\t\tOpenAI model (default: ${DEFAULT_OPTIONS.IMAGE_MODEL}) used for generate image`)
    console.log(`\t--imageStyle=...\t\tOpenAI style (default: ${DEFAULT_OPTIONS.IMAGE_STYLE}, only for dall-e-3 model) used for generate image`)
    console.log(`\t--audioModel=...\t\tOpenAI model (default: ${DEFAULT_OPTIONS.AUDIO_MODEL}) used for generate speech`)
    console.log(`\t--voice=...\t\t\tVoice (default: ${DEFAULT_OPTIONS.VOICE}) used for generate speech`)
    console.log("\t--backgroundMusic=...\t\tPath or Array of path for background music")
    console.log(`\t--backgroundMusicVolume=...\tVolume of background music (float between 0 to 1, default: ${DEFAULT_OPTIONS.BACKGROUND_MUSIC_VOLUME})`)
    console.log("\t--search=...\t\t\tAsk GPT to generate the base story use to generate video")
    console.log("\t--searchFile=...\t\tFilepath to generate new search")
    console.log("\t--story=...\t\t\tStory use to generate video")
    console.log("\t--storyFile=...\t\t\tStory file use to generate video")
    console.log("\t--highlights=...\t\tLoad highlights")
    console.log("\t--highlightsFile=...\t\tLoad highlights from file")
    console.log("\t--addImageDesc=...\t\tAdd image description")
    console.log("\t--addImageDescFile=...\t\tAdd image description file")
    console.log("\t--addSpeechsDesc=...\t\tAdd speechs description")
    console.log("\t--addSpeechsDescFile=...\t\tAdd speechs description file")
    throw new StopExecution('help')
  }

  if (!args.apiKey) {
    args.apiKey = defaultArgs.apiKey
  }

  return args
}