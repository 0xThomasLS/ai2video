import ModelAI from "./ModelAI.js"
import MistralClient from "@mistralai/mistralai"
import fetch from "node-fetch"

globalThis.fetch = fetch

class MistralAIModel extends ModelAI {
  constructor(opts) {
    super(opts)

    this.model = new MistralClient(this.apiKey)
  }

  async callTextApi(opts) {
    const result = await this.model.chat({
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
}

export default MistralAIModel