#!/usr/bin/env node
const commander = require('commander')
const chalk = require('chalk')
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')

const pkg = require('./package.json')

const error = (message) => {
  console.log(chalk.red(`\n${message}\n`))
  process.exit(1)
}

commander
  .version(pkg.version)
  .option('-t, --theme [name]', 'Theme of the chart, could be default, forest, dark or neutral. Optional. Default: default', /^default|forest|dark|neutral$/, 'default')
  .option('-w, --width [width]', 'Width of the page. Optional. Default: 800', /^\d+$/, '800')
  .option('-H, --height [height]', 'Height of the page. Optional. Default: 600', /^\d+$/, '600')
  .option('-i, --input <input>', 'Input mermaid file. Required.')
  .option('-o, --output [output]', 'Output image file. It should be either svg or png. Optional. Default: input + ".svg"')
  .parse(process.argv)

let { theme, width, height, input, output } = commander

// check input file
if (!input) {
  error('Please specify input file: -i <input>')
}
if (!fs.existsSync(input)) {
  error(`Input file "${input}" doesn't exist`)
}

// check output file
if (!output) {
  output = input + '.svg'
}
if (!/\.(?:svg|png)$/.test(output)) {
  error(`Output file must end with ".svg" or ".png"`)
}
const outputDir = path.dirname(output)
if (!fs.existsSync(outputDir)) {
  error(`Output directory "${outputDir}/" doesn't exist`)
}

// normalize args
width = parseInt(width)
height = parseInt(height)

;(async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  page.setViewport({ width, height })
  await page.goto(`file://${path.join(__dirname, 'index.html')}`)

  const definition = fs.readFileSync(input, 'utf-8')
  await page.$eval('#container', (container, definition, theme) => {
    container.innerHTML = definition
    window.mermaid_config = { theme }
    window.mermaid.init(undefined, container)
  }, definition, theme)

  if (output.endsWith('svg')) {
    const svg = await page.$eval('#container', container => container.innerHTML)
    fs.writeFileSync(output, svg)
  } else { // png
    const clip = await page.$eval('svg', svg => {
      const react = svg.getBoundingClientRect()
      return { x: react.left, y: react.top, width: react.width, height: react.height }
    })
    await page.screenshot({ path: output, omitBackground: true, clip })
  }

  browser.close()
})()
