import OpenAI2VideoError from "./OpenAI2VideoError.js"
import AI from "./ai/AI.js"

import fs from "fs"
import https from "https"
import path from "path"

import getMP3Duration from "get-mp3-duration"
import audioconcat from "audioconcat"
import ffmpeg from "fluent-ffmpeg"
import videoshow from "videoshow"
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas"


const DEFAULT_OPTIONS = {
  VIDEO_ASPECT: 'square',
  RETRY: 3,
  INTERMADIATE_FOLDER: './tmp',
  BACKGROUND_MUSIC_VOLUME: 0.1,
  TITLE_BLUR: 10,
  TITLE_MARGIN: 20,
  TITLE_FONT_SIZE: 60,
  TITLE_FONT_FAMILY: 'Ubuntu',
  CHAT_MODEL: 'gpt-4',
  IMAGE_MODEL: 'dall-e-3',
  IMAGE_STYLE: 'vivid',
  IMAGE_QUALITY: 'hd',
  AUDIO_MODEL: 'tts-1',
  VOICE: 'onyx'
}

class OpenAI2Video {
  constructor(opts) {
    this.inputs = {}
    this.outputs = {}
    this.global = {
      ai: new AI({
        openAIApiKey: opts.openAIApiKey,
        mistralApiKey: opts.mistralApiKey,
        textModel: opts.models && opts.models.chat ? opts.models.chat : DEFAULT_OPTIONS.CHAT_MODEL,
        imageModel: opts.models && opts.models.image ? opts.models.image : DEFAULT_OPTIONS.IMAGE_MODEL,
        audioModel: opts.models && opts.models.audio ? opts.models.audio : DEFAULT_OPTIONS.AUDIO_MODEL
      }),
      aspect: opts.aspect ? opts.aspect : DEFAULT_OPTIONS.VIDEO_ASPECT,
      retry: opts.retry ? opts.retry : DEFAULT_OPTIONS.RETRY,
      intermadiateFolder: opts.intermadiateFolder ? opts.intermadiateFolder : DEFAULT_OPTIONS.INTERMADIATE_FOLDER,
      backgroundMusic: opts.backgroundMusic,
      backgroundMusicVolume: opts.backgroundMusicVolume ? opts.backgroundMusicVolume : DEFAULT_OPTIONS.BACKGROUND_MUSIC_VOLUME,
      image: {
        style: opts.image && opts.image.style ? opts.image.style : DEFAULT_OPTIONS.IMAGE_STYLE,
        quality: opts.image && opts.image.quality ? opts.image.quality : DEFAULT_OPTIONS.IMAGE_QUALITY
      },
      audio: {
        voice: opts.voice ? opts.voice : DEFAULT_OPTIONS.VOICE
      },
      video: {
        width: opts.width,
        height: opts.height
      },
      title: {
        blur: DEFAULT_OPTIONS.TITLE_BLUR,
        margin: DEFAULT_OPTIONS.TITLE_MARGIN,
        font: {
          size: DEFAULT_OPTIONS.TITLE_FONT_SIZE,
          family: DEFAULT_OPTIONS.TITLE_FONT_FAMILY
        }
      }
    }

    if (!this.global.video.width) {
      this.global.video.width = 1024
      if (this.global.ai.opts.models.image === 'dall-e-3' && this.global.aspect === 'horizontal') this.global.video.width = 1792
    }
    if (!this.global.video.height) {
      this.global.video.height = 1024
      if (this.global.ai.opts.models.image === 'dall-e-3' && this.global.aspect === 'vertical') this.global.video.height = 1792
    }

    // Check intermadiate folder exist
    if (!fs.existsSync(this.global.intermadiateFolder)) {
      fs.mkdirSync(this.global.intermadiateFolder)
    }
  }

  fromSearch(prompt) {
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

  addTitleScreenText(title) {
    if (this.global.title) this.global.title.text = title
    return this
  }

  addTitleScreenBlur(blur) {
    if (this.global.title) this.global.title.blur = blur
    return this
  }

  addTitleScreenMargin(margin) {
    if (this.global.title) this.global.title.margin = margin
    return this
  }

  addTitleScreenFontSize(size) {
    if (this.global.title && this.global.title.font) this.global.title.font.size = size
    return this
  }

  addTitleScreenFontFamily(family) {
    if (this.global.title && this.global.title.font) this.global.title.font.family = family
    return this
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

  async toStory(outputPath) {
    console.log('Generate story...')
    if (!this.inputs) throw new OpenAI2VideoError(0, 'No inputs')
    
    if (this.inputs.search && !this.inputs.story) {
      this.outputs.story = await this.callAIChatAPI(this.inputs.search)
    }

    if (true === outputPath) console.log(this.outputs.story)
    else if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify(this.outputs.story), { encoding: 'utf8'})
      console.log('Story saved into: ' + outputPath)
    }

    return this
  }

  async translateHighlights(language='english', outputPath) {
    if (!this.outputs || !this.outputs.highlights) await this.toHighlights(outputPath)

    console.log('Translate highlights...')
    const highlightsTranslated = await this.callAIChatAPI("Traduis le code JSON en " + language + ".\nSeul la valeur des clés highlight sont à traduire, tout le reste doit être conserver en l\'état, c\'est à dire sans modifier aucunes autres valeurs (pas de modification sur les valeurs de \"type\" et \"prompt\", exemple pour cet objet : " + '```[{"highlight":"Etienne, 30 ans, pilote de course automobile","prompt":"Etienne 30 years old professional race-car driver","type":"normal"}]```, le résultat attendu est uniquement le JSON traduis : ```[{"highlight":"Etienne, 30 years old, racing driver","prompt":"Etienne 30 years old professional race-car driver","type":"normal"}]```). ' + "\nA toi de me répondre avec uniquement la traduction du JSON suivant : ```" + JSON.stringify(this.outputs.highlights) + '```')

    this.outputs.highlights = JSON.parse(highlightsTranslated.replaceAll("\n", '').match(/\[(.*)\]/gi)[0])

    if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify(this.outputs.highlights), { encoding: 'utf8'})
      console.log('Translation highlights description saved into: ' + outputPath)
    }

    return this
  }

  async toHighlights(outputPath) {
    if (!this.outputs || !this.outputs.story) await this.toStory()

    console.log('Generate highlights...')
    const highlights = JSON.parse((await this.callAIChatAPI(`Sans rien modifier à l'histoire, extrait les points d'intérêts (highlight) de l'histoire, ces points d'intérêts serviront à générer les illustrations pour créer les scènes vidéos, tu dois noter ces points d'intérêts au format JSON (tableau JSON) en respectant la structure suivante : \`\`\`{ "highlight": "Point d'intérêt de l'histoire", "prompt": "Prompt DALL-E"}\`\`\`. Le prompt (sans ponctuation) de génération d'image pour l'IA DALL-E, doit avoir le maximum de détail pour conserver les informations des personnages (genre, age...), des lieux... et la trame générale de l'histoire, les images doivent rester cohérente entre elles et doivent être écrite en anglais. Voici un exemple de ce qui est attendu comme objet représentant un point d'intérêt de l'histoire : \`\`\`{"highlight": "Je m'appelle Sarah et j'ai 25 ans. Mon histoire s'est déroulée un soir de juillet 2018, alors que je rentrais en vélo électrique de mon travail, à seulement quelques kilomètres de chez moi. En été, j'ai l'habitude de prendre mon vélo électrique, c'est plus sympa et plus écologique aussi.", "prompt": "Sarah 25 years old cycles home from work"}\`\`\`. A toi de réaliser ce découpage avec l'histoire : "${this.outputs.story}"`)).replace('`', ''))

    if (this.global.title) {
      highlights.unshift({ type: 'title', highlight: this.global.title.text })
    }

    this.outputs.highlights = highlights.map((highlight) => {
      const item = highlight

      if (!item.type) {
        item.type = 'normal'
      }

      return item
    })

    if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify(this.outputs.highlights), { encoding: 'utf8'})
      console.log('Highlights description saved into: ' + outputPath)
    }

    return this
  }

  async toImages(outputPath) {
    if (!this.outputs || !this.outputs.highlights) await this.toHighlights()
    if (!this.outputs.images) this.outputs.images = []

    const startI = this.outputs.images ? this.outputs.images.length : 0
    let error = false

    if (startI < this.outputs.highlights.length) console.log('Generate images...')

    for (let i=startI; i<this.outputs.highlights.length; i++) {
      if (this.outputs.highlights[i].type === 'normal') {
        console.log(`Generate image for highlight (${(i+1)}/${this.outputs.highlights.length})...`)
        try {
          const image = await this.callAIImageAPI(i+1, this.outputs.highlights[i].prompt)
          image.type = this.outputs.highlights[i].type
          this.outputs.images.push(image)
        } catch (e) {
          if (e && e.status === 400 && e.code === '') {
            error = e
          } else {
            throw e
          }
        }
      }
    }

    // Remove previous title screen image
    if (!error && this.outputs.images[0].type === 'title') this.outputs.images.shift()

    if (!error && this.outputs.highlights[0].type === 'title' && this.outputs.images.length > 0) {
      console.log('Generate title screen...')
      const titleOutputPath = path.resolve(this.global.intermadiateFolder + '/title.jpg')

      await generateTitleScreen({
        text: this.outputs.highlights[0].highlight,
        backgroundImage: this.outputs.images[0].path,
        width: this.global.video.width,
        height: this.global.video.height,
        outputPath: titleOutputPath,
        blur: this.global.title.blur,
        margin: this.global.title.margin,
        font: {
          size: this.global.title.font.size,
          family: this.global.title.font.family
        }
      })

      this.outputs.images.unshift({
        type: 'title',
        path: titleOutputPath
      })
    }

    if (outputPath && this.outputs.images.length > 0) {
      fs.writeFileSync(outputPath, JSON.stringify(this.outputs.images), { encoding: 'utf8'})
      console.log('Images description saved into: ' + outputPath)
    }

    if (error) throw error
    return this
  }

  async toAudio(outputPath, outputDescPath) {
    if (!this.outputs || !this.outputs.highlights) await this.toHighlights()

    if (!this.outputs.speechs || this.outputs.speechs.length != this.outputs.highlights.length) {
      console.log('Generate speechs...')
      this.outputs.speechs = []
      for (let i=0; i<this.outputs.highlights.length; i++) {
        console.log(`Generate speech for highlight (${(i+1)}/${this.outputs.highlights.length})...`)
        this.outputs.speechs[i] = await this.callAIAudioAPI(i+1, this.outputs.highlights[i].highlight + (this.outputs.highlights[i].type === 'title' ? '!' : ''))
      }
    }

    if (outputDescPath) {
      fs.writeFileSync(outputDescPath, JSON.stringify(this.outputs.speechs), { encoding: 'utf8'})
      console.log('Audios speechs description saved into: ' + outputPath)
    }

    console.log('Generate audio file...')
    this.outputs.audio = await this.generateAudioFile(outputPath)

    return this
  }

  async toVideo(outputPath) {
    if (!this.outputs || !this.outputs.highlights) await this.toHighlights()
    if (!this.outputs || !this.outputs.images || this.outputs.images.length != this.outputs.highlights.length) await this.toImages()

    // Generate video
    console.log('Generate video...')
    await this.generateVideoFile(outputPath)
    this.outputs.video = outputPath

    return this
  }

  async toAudioAndVideo(audioPath, videoPath, outputDescPath) {
    if (!this.outputs || !this.outputs.highlights) await this.toHighlights()
    
    // Generate Image
    await this.toImages()
    
    // Generate Audio
    await this.toAudio(audioPath, outputDescPath)

    // Generate video
    console.log('Generate video...')
    const tmpVideoPath = this.global.intermadiateFolder + '/video.mp4'
    await this.generateVideoFile(tmpVideoPath)

    // Merge audio and video
    console.log('Merge audio and video...')
    await mergeAudioAndVideo(audioPath, tmpVideoPath, videoPath)

    this.outputs.audio = audioPath
    this.outputs.video = videoPath

    return this
  }

  async callAIChatAPI(prompt) {
    return await this.global.ai.text({ prompt })
  }

  async callAIImageAPI(id, prompt, retry=this.global.retry) {
    try {
      const image = await this.global.ai.image({
        id: id,
        prompt: `Generate an image of "${prompt}" by complying content policy. Realistic photo, vertical format, portrait orientation, no text`,
        style: this.global.image.style,
        size: `${this.global.video.width}x${this.global.video.height}`,
        response_format: 'url',
        quality: this.global.image.quality
      })

      // Retrieve image and create temporary file
      const imageBuffer = await createBufferFromUrl(image.url, this.global.retry)
      const imagePath = path.resolve(`${this.global.intermadiateFolder}/img${id}.png`)
      fs.writeFileSync(imagePath, imageBuffer)

      return {
        url: image.url,
        path: imagePath
      }
    } catch (e) {
      if (retry > 1) {
        return this.callAIImageAPI(id, prompt, retry-1)
      }
      throw e
    }
  }

  async callAIAudioAPI(id, prompt) {
    const mp3 = await this.global.ai.audio({
      voice: this.global.audio.voice,
      prompt: prompt
    })
    
    // Retrieve and create speech mp3
    const buffer = Buffer.from(await mp3.arrayBuffer())
    const speechPath = path.resolve(`${this.global.intermadiateFolder}/speech${id}.mp3`)
    fs.writeFileSync(speechPath, buffer)
    
    return {
      path: speechPath,
      duration: getMP3Duration(buffer)
    }
  }

  async generateAudioFile(outputPath) {
    console.log('Merge speechs...')
    const speechAudioPath = this.global.intermadiateFolder + '/speech.mp3'
    await concatAudioFile(this.outputs.speechs.map(speech => speech.path), speechAudioPath)

    if (this.global.backgroundMusic) {
      const musicAudioPath = this.global.intermadiateFolder + '/music.mp3'
      await this.createBackgroundMusic(musicAudioPath)
      console.log('Merge audio speech and music files...')
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
    const buffer = fs.readFileSync(this.global.intermadiateFolder + '/speech.mp3')
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
    const fps = 30
    let filterInverted = false

    return new Promise((resolve, reject) => {
      videoshow(
        this.outputs.highlights.map(
          (highlight, id) => {
            const image = {
              path: this.outputs.images[id].path,
              loop: this.outputs.speechs[id].duration / 1000
            }
            
            if (!highlight.type || highlight.type != 'title') {
              if (filterInverted) image.filters = "zoompan=z='1.5-on/duration*0.5'"
              else image.filters = "zoompan=z='zoom+0.0015'"
              image.filters += `:x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=${fps}*${image.loop}:s=${this.global.video.width}x${this.global.video.height}:fps=${fps}`
              filterInverted = !filterInverted

              image.caption = highlight.highlight
              image.captionStart = 100
            }
            
            if (id === 0) {
              image.transition = false
            }
            
            return image
          }
        ), 
        {
          fps: fps,
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
        .on('error', function (e) {
          reject(e)
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
    const ffmpegOpts = [ '-map 0:v', '-map 1:a', '-c:v copy', '-c:a aac', '-movflags faststart', '-vcodec mpeg4', '-strict', '-2' ]

    ffmpeg()
        .addInput(video)
        .addInput(audio)
        .addOptions(ffmpegOpts)
        .on('error', error => {
          reject(error)
        })
        .on('end', () => {
          resolve()
        })
        .saveToFile(output)
  })
}

async function generateTitleScreen(opts) {
  const canvas = createCanvas(opts.width, opts.height)
  const ctx = canvas.getContext('2d')

  if (opts.backgroundImage) {
    const background = await loadImage(opts.backgroundImage)
    ctx.filter = `blur(${opts.blur}px)`
    ctx.drawImage(background, 0, 0, opts.width, opts.height)
    ctx.filter = 'blur(0px)'
  }

  if (opts.text) {
    const lines = writeMultiLineCentered(ctx, {
      text: opts.text,
      font: {
        size: opts.font.size,
        family: opts.font.family
      },
      width: opts.width,
      height: opts.height,
      margin: opts.margin
    })

    // Generate Tiktok panel
    templateTiktokPanel(ctx, opts, lines)

    // Title
    ctx.fillStyle = '#FFFFFF'
    lines.draw()
  }

  // Write image
  fs.writeFileSync(opts.outputPath, await canvas.encode('jpeg'))
}

function writeMultiLineCentered(ctx, opts) {
  ctx.font = opts.font.size + 'px ' + opts.font.family

  const maxWidth = opts.width - (6 * opts.margin)
  const lines = splitText(ctx, opts.text, maxWidth)
  const firstLineY = (opts.height - (lines.length * opts.font.size)) / 2

  let maxLineWidth = ctx.measureText(lines[0]).width
  for (let i=1; i<lines.length; i++) {
    const actualLineWidth = ctx.measureText(lines[i]).width
    if (actualLineWidth > maxLineWidth) {
      maxLineWidth = actualLineWidth
    }
  }

  return {
    x: (opts.width - maxLineWidth) / 2,
    y: firstLineY,
    width: maxLineWidth,
    height: lines.length * opts.font.size,
    draw() {
      ctx.font = opts.font.size + 'px ' + opts.font.family

      lines.forEach((line, pos) => {
        const size = ctx.measureText(line)

        ctx.fillText(line, (opts.width - size.width) / 2, firstLineY + (opts.font.size * (pos+1)))
      })
    }
  }
}

function splitText(ctx, text, maxWidth) {
  const size = ctx.measureText(text)
  const ratio = size.width / maxWidth

  if (ratio <= 1) return [ text ]

  const words = text.split(' ')
  const lines = [ [] ]

  let i = 0
  while (words.length > 0) {
    const newWord = words.shift()
    if (ctx.measureText(lines[i].join(' ') + ' ' + newWord).width >= maxWidth) {
      i++
      lines[i] = []
    }

    lines[i].push(newWord)
  }

  return lines.map(line => line.join(' '))
}

function templateTiktokPanel(ctx, opts, lines) {
  // Rectangle bleu
  ctx.fillStyle = '#2AD2EA'
  ctx.fillRect(lines.x-(2*opts.margin), lines.y-(2*opts.margin)+(opts.font.size/5), lines.width+(2*opts.margin), lines.height+(2*opts.margin))

  // Triangle supérieur
  ctx.beginPath()
  ctx.moveTo(lines.x+lines.width-1, lines.y-(2*opts.margin)+(opts.font.size/5))
  ctx.lineTo(lines.x+lines.width+opts.margin, lines.y-opts.margin+(opts.font.size/5))
  ctx.lineTo(lines.x+lines.width-1, lines.y-opts.margin+(opts.font.size/5))
  ctx.fill()

  // Triangle inférieur
  ctx.beginPath()
  ctx.moveTo(lines.x-(2*opts.margin), lines.y+(opts.font.size/5)+lines.height)
  ctx.lineTo(lines.x-opts.margin, lines.y+(opts.font.size/5)+lines.height)
  ctx.lineTo(lines.x-opts.margin, lines.y+(opts.font.size/5)+lines.height+opts.margin)
  ctx.fill()

  // Rectangle rouge
  ctx.fillStyle = '#F53159'
  ctx.fillRect(lines.x, lines.y+(opts.font.size/5), lines.width+(2*opts.margin), lines.height+(2*opts.margin))

  // Triangle supérieur
  ctx.beginPath()
  ctx.moveTo(lines.x+lines.width+opts.margin, lines.y-opts.margin+(opts.font.size/5))
  ctx.lineTo(lines.x+lines.width+(2*opts.margin), lines.y+(opts.font.size/5))
  ctx.lineTo(lines.x+lines.width+opts.margin, lines.y+(opts.font.size/5))
  ctx.fill()

  // Triangle inférieur
  ctx.beginPath()
  ctx.moveTo(lines.x-opts.margin, lines.y+(opts.font.size/5)+lines.height+opts.margin)
  ctx.lineTo(lines.x, lines.y+(opts.font.size/5)+lines.height+opts.margin)
  ctx.lineTo(lines.x, lines.y+(opts.font.size/5)+lines.height+(2*opts.margin))
  ctx.fill()

  // Rectangle noir central
  ctx.fillStyle = '#000000'
  ctx.fillRect(lines.x-opts.margin, lines.y-opts.margin+(opts.font.size/5), lines.width+(2*opts.margin), lines.height+(2*opts.margin))
}