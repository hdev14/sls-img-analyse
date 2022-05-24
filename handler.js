'use strict';

const AWS = require('aws-sdk');
const axios = require('axios');

class ImageAnalysis {
  constructor({ rekognition, translator }) {
    this.rekognition = rekognition;
    this.translator = translator;
  }

  async detectImageLabels(buffer) {
    const result = await this.rekognition.detectLabels({
      Image: { Bytes: buffer },
    }).promise();

    const filteredLabels = result.Labels.filter(({ Confidence }) => Confidence > 80);

    const names = filteredLabels.map(({ Name }) => Name).join(' and ');

    return { names, labels: filteredLabels };
  }

  async translateNames(names) {
    const result = await this.translator.translateText({
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'pt',
      Text: names,
    }).promise();

    return result.TranslatedText.split(' e ');
  }

  async getImageBuffer(imageUrl) {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data, 'base64');

    return buffer;
  }

  formatTextResults(names, labels) {
    const phrases = [];

    for (const index in names) {
      const nameInPortuguese = names[index];
      const confidence = labels[index].Confidence;

      phrases.push(` ${confidence.toFixed(2)}% de ser do tipo ${nameInPortuguese}`);
    }

    return phrases.join('\n');
  }

  async main(event) {
    try {
      const { imageUrl } = event.queryStringParameters;

      const buffer  = await this.getImageBuffer(imageUrl);

      const { names, labels } = await this.detectImageLabels(buffer);

      const translatedNames = await this.translateNames(names);

      const message = this.formatTextResults(translatedNames, labels);

      return {
        statusCode: 200,
        body: `A imagem tem\n ${message}`,
      };
    } catch (error) {
      console.error('Error**', error.stack);

      return {
        statusCode: 500,
        body: 'Internal Server Error',
      };
    }
  }
}


function createHandler() {
  const rekognition = new AWS.Rekognition();
  const translator = new AWS.Translate();

  const imageAnalysis = new ImageAnalysis({ rekognition, translator });

  return imageAnalysis.main.bind(imageAnalysis);
}

module.exports.main = createHandler();
