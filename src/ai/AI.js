import OpenAI2VideoError from "../OpenAI2VideoError.js"
import MistralAIModel from "./MistralAIModel.js"
import OpenAIModel from "./OpenAIModel.js"

class AI {
    constructor(opts) {
        this.opts = {
            apiKey: {
                openai: opts.openAIApiKey,
                mistral: opts.mistralApiKey
            },
            models: {
                text: opts.textModel,
                image: opts.imageModel,
                audio: opts.audioModel
            }
        }

        if (this.opts.apiKey.openai) this.openai = new OpenAIModel({ apiKey: this.opts.apiKey.openai })
        if (this.opts.apiKey.mistral) this.mistral = new MistralAIModel({ apiKey: this.opts.apiKey.mistral })
    }

    getModelAI(label) {
        const aiModel = this.opts.models[label].split('-')[0]

        if ('mistral' === aiModel) {
            if (!this.opts.apiKey.mistral) throw new OpenAI2VideoError(404, 'Mistral API Key unknown')
            return this.mistral
        }
        else if (['gpt', 'dall', 'tts'].includes(aiModel)) {
            if (!this.opts.apiKey.openai) throw new OpenAI2VideoError(404, 'OpenAI API Key unknown')
            return this.openai
        }

        throw new OpenAI2VideoError(404, 'AI model unknown')
    }

    get text() {
        return async (opts) => {
            opts.model = this.opts.models.text
            return await this.getModelAI('text').callTextApi(opts)
        }
    }

    get image() {
        return async (opts) => {
            opts.model = this.opts.models.image
            return await this.getModelAI('image').callImageApi(opts)
        }
    }

    get audio() {
        return async (opts) => {
            opts.model = this.opts.models.audio
            return await this.getModelAI('audio').callAudioApi(opts)
        }
    }
}

export default AI