import OpenAI2VideoError from "./OpenAI2VideoError.js"

import fs from "fs"
import https from "https"
import path from "path"

import OpenAI from "openai"
import getMP3Duration from "get-mp3-duration"
import audioconcat from "audioconcat"
import ffmpeg from "fluent-ffmpeg"
import videoshow from "videoshow"


const DEFAULT_OPTIONS = {
  VIDEO_ASPECT: 'square',
  RETRY: 3,
  TEMPORARY_FOLDER: './tmp',
  CHAT_MODEL: 'gpt-4',
  IMAGE_MODEL: 'dall-e-3',
  AUDIO_MODEL: 'tts-1',
  IMAGE_STYLE: 'vivid',
  VOICE: 'onyx',
  BACKGROUND_MUSIC_VOLUME: 0.1
}

class OpenAI2Video {
  constructor(opts) {
    this.inputs = {}
    this.outputs = {}

    const openAiOpts = {}

    if (!opts.openAIApiKey) {
      throw new OpenAI2VideoError({
        status: 0,
        message: 'OpenAI API key is mandatory'
      })
    }
    openAiOpts.apiKey = opts.openAIApiKey

    this.global = {
      openai: new OpenAI(openAiOpts),
      aspect: opts.aspect ? opts.aspect : DEFAULT_OPTIONS.VIDEO_ASPECT,
      retry: opts.retry ? opts.retry : DEFAULT_OPTIONS.RETRY,
      temporaryFolder: opts.temporaryFolder ? opts.temporaryFolder : DEFAULT_OPTIONS.TEMPORARY_FOLDER,
      backgroundMusic: opts.backgroundMusic,
      backgroundMusicVolume: opts.backgroundMusicVolume ? opts.backgroundMusicVolume : DEFAULT_OPTIONS.BACKGROUND_MUSIC_VOLUME,
      models: {
        chat: opts.models && opts.models.chat ? opts.models.chat : DEFAULT_OPTIONS.CHAT_MODEL,
        image: opts.models && opts.models.image ? opts.models.image : DEFAULT_OPTIONS.IMAGE_MODEL,
        audio: opts.models && opts.models.audio ? opts.models.audio : DEFAULT_OPTIONS.AUDIO_MODEL,
      },
      image: {
        style: opts.image && opts.image.style ? opts.image.style : DEFAULT_OPTIONS.IMAGE_STYLE
      },
      audio: {
        voice: opts.voice ? opts.voice : DEFAULT_OPTIONS.VOICE
      },
      video: {
        width: opts.width,
        height: opts.height
      }
    }

    if (!this.global.video.width) {
      this.global.video.width = 1024
      if (this.global.models.image === 'dall-e-3' && this.global.aspect === 'horizontal') this.global.video.width = 1792
    }
    if (!this.global.video.height) {
      this.global.video.height = 1024
      if (this.global.models.image === 'dall-e-3' && this.global.aspect === 'vertical') this.global.video.height = 1792
    }
  }

  fromSearch(prompt) {
    console.log('Search...')
    this.inputs.search = prompt
    return this
  }

  fromSearchFile(filePath) {
    const prompt = fs.readFileSync(filePath, { encoding: 'utf8'})
    return this.fromSearch(prompt)
  }

  fromStory(story) {
    this.inputs.story = story
    this.outputs.story = story
    return this
  }

  fromStoryFile(filePath) {
    const story = fs.readFileSync(filePath, { encoding: 'utf8'})
    return this.fromStory(story)
  }

  fromHighlights(json) {
    this.inputs.highlights = json
    this.outputs.highlights = json
    return this
  }

  fromHighlightsFile(filePath) {
    const highlights = fs.readFileSync(filePath, { encoding: 'utf8'})
    return this.fromHighlights(JSON.parse(highlights))
  }

  async toStory() {
    console.log('Generate story...')
    if (!this.inputs) throw new OpenAI2VideoError(0, 'No inputs')
    
    if (this.inputs.search && !this.inputs.story) {
      this.outputs.story = await this.callOpenAIChatAPI(this.inputs.search)
    }

    return this.outputs
  }

  async toHighlights(outputPath) {
    if (!this.outputs || !this.outputs.story) await this.toStory()

    console.log('Generate highlights...')
    this.outputs.highlights = JSON.parse((await this.callOpenAIChatAPI(`Extrait les points d'intérêts (highlight) de l'histoire, ces points d'intérêts serviront à générer les illustrations pour créer les scènes vidéos, tu dois noter ces points d'intérêts au format JSON (tableau JSON) en respectant la structure suivante : \`\`\`{ "highlight": "Point d'intérêt de l'histoire", "prompt": "Prompt DALL-E"}\`\`\`. Le prompt (sans ponctuation) de génération d'image pour l'IA DALL-E, doit avoir le maximum de détail pour conserver les informations des personnages (genre, age...), des lieux... et la trame générale de l'histoire, les images doivent rester cohérente entre elles et doivent être écrite en anglais. Voici un exemple de ce qui est attendu comme objet représentant un point d'intérêt de l'histoire : \`\`\`{"highlight": "Je m'appelle Sarah et j'ai 25 ans. Mon histoire s'est déroulée un soir de juillet 2018, alors que je rentrais en vélo électrique de mon travail, à seulement quelques kilomètres de chez moi. En été, j'ai l'habitude de prendre mon vélo électrique, c'est plus sympa et plus écologique aussi.", "prompt": "Sarah 25 years old cycles home from work"}\`\`\`. A toi de réaliser ce découpage avec l'histoire : "${this.outputs.story}"`)).replace('`', ''))

    if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify(this.outputs.highlights), { encoding: 'utf8'})
    }

    return this.outputs
  }

  addImagesDescription(json) {
    this.inputs.images = json
    this.outputs.images = json
    return this
  }

  addImagesDescriptionFile(filePath) {
    const images = fs.readFileSync(filePath, { encoding: 'utf8'})
    return this.addImagesDescription(JSON.parse(images))
  }

  async toImages(outputPath) {
    if (!this.outputs || !this.outputs.highlights) await this.toHighlights()

    console.log('Generate images...')
    this.outputs.images = []
    for (let i=0; i<this.outputs.highlights.length; i++) {
      console.log(`Generate image for highlight (${(i+1)}/${this.outputs.highlights.length})...`)
      this.outputs.images[i] = await this.callOpenAIImageAPI(i+1, this.outputs.highlights[i].prompt)
    }

    if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify(this.outputs.images), { encoding: 'utf8'})
    }

    return this.outputs
  }

  addBackgroundMusicList(list) {
    this.global.backgroundMusic = list
    return this
  }

  addSpeechsDescription(json) {
    this.inputs.speechs = json
    this.outputs.speechs = json
    return this
  }

  addSpeechsDescriptionFile(filePath) {
    const speechs = fs.readFileSync(filePath, { encoding: 'utf8'})
    return this.addSpeechsDescription(JSON.parse(speechs))
  }

  async toAudio(outputPath, outputDescPath) {
    if (!this.outputs || !this.outputs.highlights) await this.toHighlights()

    if (!this.outputs.speechs || this.outputs.speechs.length != this.outputs.highlights.length) {
      console.log('Generate speechs...')
      this.outputs.speechs = []
      for (let i=0; i<this.outputs.highlights.length; i++) {
        console.log(`Generate speech for highlight (${(i+1)}/${this.outputs.highlights.length})...`)
        this.outputs.speechs[i] = await this.callOpenAIAudioAPI(i+1, this.outputs.highlights[i].highlight)
      }
    }

    if (outputDescPath) {
      fs.writeFileSync(outputDescPath, JSON.stringify(this.outputs.speechs), { encoding: 'utf8'})
    }

    console.log('Generate audio file...')
    this.outputs.audio = await this.generateAudioFile(outputPath)

    return this.outputs
  }

  async toVideo(outputPath) {
    if (!this.outputs || !this.outputs.highlights) await this.toHighlights()
    if (!this.outputs || !this.outputs.images) await this.toImages()

    // Generate video
    console.log('Generate video...')
    await this.generateVideoFile(outputPath)
    this.outputs.video = outputPath

    return this.outputs
  }

  async toAudioAndVideo(audioPath, videoPath) {
    if (!this.outputs || !this.outputs.highlights) await this.toHighlights()
    if (!this.outputs || !this.outputs.images) await this.toImages()
    if (!this.outputs || !this.outputs.speechs) await this.toAudio(audioPath)

    // Generate video
    console.log('Generate video...')
    const tmpVideoPath = this.global.temporaryFolder + '/video.mp4'
    await this.generateVideoFile(tmpVideoPath)

    // Merge audio and video
    console.log('Merge audio and video...')
    await mergeAudioAndVideo(audioPath, tmpVideoPath, videoPath)

    this.outputs.audio = audioPath
    this.outputs.video = videoPath

    return this.outputs
  }

  async callOpenAIChatAPI(prompt) {
    const result = await this.global.openai.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt
        },
      ],
      model: this.global.models.chat
    })
  
    return result.choices[0].message.content
  }

  async callOpenAIImageAPI(id, prompt, retry=this.global.retry) {
    try {
      const image = await this.global.openai.images.generate({
        model: this.global.models.image,
        prompt: `Generate an image of "${prompt}" by complying content policy. Realistic photo, vertical format, portrait orientation, no text`,
        style: this.global.image.style,
        size: `${this.global.video.width}x${this.global.video.height}`,
        response_format: 'url'
      })
    
      // Retrieve image and create temporary file
      const imageBuffer = await createBufferFromUrl(image.data[0].url, this.global.retry)
      const imagePath = path.resolve(`${this.global.temporaryFolder}/img${id}.png`)
      fs.writeFileSync(imagePath, imageBuffer)

      return {
        url: image.data[0].url,
        path: imagePath
      }
    } catch (e) {
      if (retry > 1) {
        return this.callOpenAIImageAPI(id, prompt, retry-1)
      }
  
      throw e
    }
  }

  async callOpenAIAudioAPI(id, prompt) {
    const mp3 = await this.global.openai.audio.speech.create({
      model: this.global.models.audio,
      voice: this.global.audio.voice,
      input: prompt,
    })
  
    // Retrieve and create speech mp3
    const buffer = Buffer.from(await mp3.arrayBuffer())
    const speechPath = path.resolve(`${this.global.temporaryFolder}/speech${id}.mp3`)
    fs.writeFileSync(speechPath, buffer)
  
    return {
      path: speechPath,
      duration: getMP3Duration(buffer)
    }
  }

  async generateAudioFile(outputPath) {
    console.log('Merge speechs...')
    const speechAudioPath = this.global.temporaryFolder + '/speech.mp3'
    await concatAudioFile(this.outputs.speechs.map(speech => speech.path), speechAudioPath)
  
    if (this.global.backgroundMusic) {
      console.log('Merge audio speech and music files...')
      const musicAudioPath = this.global.temporaryFolder + '/music.mp3'
      await this.createBackgroundMusic(musicAudioPath)
      await mergeAudioFile(speechAudioPath, musicAudioPath, {
        audio1Volume: 1,
        audio2Volume: this.global.backgroundMusicVolume,
        outputPath: outputPath
      })
    } else {
      fs.copyFileSync(speechAudioPath, outputPath)
    }

    return outputPath
  }

  async createBackgroundMusic(output) {
    console.log('Generate background music...')
  
    // Get duration of speech audio
    const buffer = fs.readFileSync(this.global.temporaryFolder + '/speech.mp3')
    const speechDuration = getMP3Duration(buffer)

    const musicList = []
    let musicDuration = 0
  
    let i = 0
    while (musicDuration < speechDuration) {
      const buffer = fs.readFileSync(path.resolve(this.global.backgroundMusic[i]))
      musicDuration += getMP3Duration(buffer)
      musicList.push(this.global.backgroundMusic[i])
  
      i += 1
  
      if (i >= this.global.backgroundMusic.length) {
        i = 0
      }
    }
  
    await concatAudioFile(musicList, output)
  }

  async generateVideoFile(output) {
    return new Promise((resolve, reject) => {
      videoshow(
        this.outputs.highlights.map(
          (highlight, id) => ({
            path: this.outputs.images[id].path,
            caption: highlight.highlight,
            captionStart: 100,
            loop: this.outputs.speechs[id].duration / 1000
          })
        ), 
        {
          fps: 30,
          captionDelay: 0,
          size: `${this.global.video.width}x${this.global.video.height}`,
          subtitleStyle: {
            Fontsize: '18',
            PrimaryColour: '16777215',
            BackColour: '-2147483640',
            Outline: '40',
            MarginL: '60',
            MarginR: '60',
            MarginV: '60'
          }
        }
      )
        .save(output)
        .on('error', function () {
          reject()
        })
        .on('end', function () {
          resolve()
        })
    })
  }
}

export {
  DEFAULT_OPTIONS,
  OpenAI2Video,
  OpenAI2VideoError
}

export default OpenAI2Video


/**
 * Define function to create buffer from external URL
 */
async function createBufferFromUrl(url, limit=3) {
  return new Promise((resolve, reject) => {
    const readable = []

    https.get(url, (response) => {
      response.on('data', (chunk) => {
        readable.push(chunk)
      })

      response.on('end', () => {
        resolve(Buffer.concat(readable))
      })
    }).on('error', (error) => {
      if (limit > 1) {
        resolve(createBufferFromUrl(url, limit-1))
      } else {
        reject(error)
      }
    })
  })
}

async function concatAudioFile(audios, output) {
  return new Promise((resolve, reject) => {
    audioconcat(audios)
      .concat(output)
      .on('error', function (error) {
        reject(error)
      })
      .on('end', async function () {
        resolve()
      })
  })
}

async function mergeAudioFile(audio1, audio2, opts) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .addInput(audio1)
      .addInput(audio2)
      .complexFilter([{
          filter: 'volume',
          options: ['5'],
          inputs: '0:0',
          outputs: '[s1]'
        },
        {
          filter: 'volume',
          options: ['5'],
          inputs: '1:0',
          outputs: '[s2]'
        },
        {
          filter: 'amix',
          inputs: [ '[s1]', '[s2]' ],
          options: [
            'duration=first',
            'dropout_transition=0',
            'weights=' + opts.audio1Volume + ' ' + opts.audio2Volume,
            'normalize=0'
          ]
        }
      ])
      .on('error', function(error) {
        reject(error)
      })
      .on('end', function() {
        resolve()
      })
      .save(opts.outputPath)
  })
}

async function mergeAudioAndVideo(audio, video, output) {
  return new Promise((resolve, reject) => {
    ffmpeg()
        .addInput(video)
        .addInput(audio)
        .addOptions(['-map 0:v', '-map 1:a', '-c:v copy', '-c:a aac', '-movflags faststart', '-vcodec mpeg4', '-strict', '-2' ])
        .on('error', error => {
          reject(error)
        })
        .on('end', () => {
          resolve()
        })
        .saveToFile(output)
  })
}