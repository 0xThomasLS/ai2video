class ModelAI {
  constructor(opts) {
    this.apiKey = opts.apiKey
  }

  async callTextApi(opts) { return false }
  async callImageApi(opts) { return false }
  async callAudioApi(opts) { return false }
}

export default ModelAI