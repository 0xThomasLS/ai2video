import { OpenAI2Video, OpenAI2VideoError } from "./index.js"
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas"
import fs from "fs"
import "dotenv/config"

main()

async function main() {
    const maker = new OpenAI2Video({
      openAIApiKey: process.env.OPEN_AI_API_KEY,
      mistralApiKey: process.env.MISTRAL_API_KEY,
      aspect: 'vertical',
      intermadiateFolder: './tmp',
      voice: 'onyx',
      models: {
        chat: 'mistral-medium',
        image: 'dall-e-3',
        audio: 'tts-1'
      },
      image: {
        style: 'vivid'
      }
    })

    const storyName = 'short-etienne-story-fr'

    const results = await maker
        .fromHighlightsFile(`./inputs/highlights/${storyName}.json`)
        .addSpeechsDescriptionFile(`./inputs/speechs/${storyName}.json`)
        .addBackgroundMusicList([ './inputs/musics/lost-soul.mp3' ])
        .addImagesDescriptionFile(`./inputs/images/${storyName}.json`)
        .toAudioAndVideo(`./outputs/${storyName}.mp3`, `./outputs/${storyName}.mp4`)
    
    console.log('Results:', results)
}