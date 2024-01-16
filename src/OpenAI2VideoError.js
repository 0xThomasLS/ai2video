class OpenAI2VideoError {
    constructor(status, message) {
        this.error = {
            status,
            message
        }
    }

    toString() {
        return `OpenAI2VideoError (${this.error.status}): ${this.error.message}`
    }
}

export default OpenAI2VideoError