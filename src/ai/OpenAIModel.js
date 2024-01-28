import ModelAI from "./ModelAI.js"
import OpenAI from "openai"

class OpenAIModel extends ModelAI {
  constructor(opts) {
    super(opts)

    this.model = new OpenAI({
      apiKey: this.apiKey
    })
  }

  async callTextApi(opts) {
    const result = await this.model.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: opts.prompt
        },
      ],
      model: opts.model
    })
  
    return result.choices[0].message.content
  }

  async callImageApi(opts) {
    try {
      const image = await this.model.images.generate({
        model: opts.model,
        prompt: `Imagine and generate an image of "${opts.prompt}". Realistic photo, vertical format, portrait orientation, no text`,
        style: opts.style,
        size: opts.size,
        response_format: 'url'
      })
  
      return {
        url: image.data[0].url
      }
    } catch (e) {
      if (e && e.code && e.status && e.status === 400 && e.code === 'content_policy_violation') {
        console.error(`Error to generate image ${opts.id} for "${opts.prompt}" prompt`)
      }
      throw e
    }
  }

  async callAudioApi(opts) {
    return await this.model.audio.speech.create({
      model: opts.model,
      voice: opts.voice,
      input: opts.prompt
    })
  }
}

export default OpenAIModel