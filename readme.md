# Hello Swagger

Experiment (and WIP) to validate a [zeit/micro](https://github.com/zeit/micro) service with an [Open API (fka Swagger) schema](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md):

```js
module.exports = validate('./schema.yaml', async (req, res) => { /* your micro service */ })
```


## Demo

Try it out:

```
npm install
npm run dev
```

Open [http://localhost:3000/?name=Swagger](http://localhost:3000/?name=Swagger) in your browser.