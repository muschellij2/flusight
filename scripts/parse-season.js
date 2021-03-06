/**
 * Script to parse and write data for a single season
 * This is supposed to be called in child processes via the main parse script
 */

const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const region = require('./modules/region')
const transform = require('./modules/transform')
const stats = require('./modules/stats')
const baseline = require('./modules/baseline')

// Variables and paths
const dataDir = './data'
const outDir = './src/assets/data'
const baselineFile = './scripts/assets/wILI_Baseline.csv'

// Get baseline data
let baselineData = baseline.getBaselines(baselineFile)

// Look for seasons in the data directory
let seasons = utils.getSubDirectories(dataDir)

// Take input file from command line argument
let seasonInFile = process.argv[2]
// Season actual files are named <season-id>-actual.json
let seasonId = path.basename(seasonInFile).slice(0, -12)
let seasonIdx = seasons.indexOf(seasonId)

// Create cache for file data
let cachedCSVs = {}

let seasonOutFile
if (seasonIdx === seasons.length - 1) {
  seasonOutFile = path.join(outDir, 'season-latest.json')
} else {
  seasonOutFile = path.join(outDir, `season-${seasonId}.json`)
}

fs.readFile(seasonInFile, 'utf8', (err, fileData) => {
  if (err) throw err
  let actualData = JSON.parse(fileData)
  console.log(`\n Parsing data for season ${seasonId}...`)
  let output = {
    seasonId: seasonId,
    regions: []
  }

  output.regions = region.regionData.map(reg => {
    // Get models for each season
    let modelsDir = utils.getSubDirectories(path.join(dataDir, seasonId))
    let models = modelsDir.map(model => {
      // Bootstrap cache
      if (!(model in cachedCSVs)) {
        cachedCSVs[model] = {}
      }

      // Get prediction weeks for each model
      let weekStamps = utils.getWeekFiles(path.join(dataDir, seasonId, model))
      let modelMeta = utils.getModelMeta(path.join(dataDir, seasonId, model))
      let seasonWeekStamps = utils.seasonToWeekStamps(seasonId)

      let modelPredictions = seasonWeekStamps.map((sweek, index) => {
        if (weekStamps.indexOf(sweek) === -1) {
          // Prediction not available for this week, return null
          return null
        }

        let fileName = path.join(dataDir, seasonId, model, sweek + '.csv')
        let data = null
        // Take from cache to avoid file reads
        if (sweek in cachedCSVs[model]) {
          data = cachedCSVs[model][sweek]
        } else {
          data = transform.csvToJson(fs.readFileSync(fileName, 'utf8'))
          cachedCSVs[model][sweek] = data
        }
        // Take only for the current region
        let filtered = utils.regionFilter(data, reg.subId)
        if (filtered === -1) return null
        else {
          // Transform weeks predictions to season indices
          let timeTargets = ['peakTime', 'onsetTime']
          timeTargets.forEach(t => {
            filtered[t].point = utils.weekToIndex(filtered[t].point, seasonWeekStamps)
            filtered[t].high = filtered[t].high.map(val => utils.weekToIndex(val, seasonWeekStamps))
            filtered[t].low = filtered[t].low.map(val => utils.weekToIndex(val, seasonWeekStamps))
          })
          return filtered
        }
      })

      return {
        id: model,
        meta: modelMeta,
        predictions: modelPredictions
      }
    })
    return {
      id: reg.id,
      actual: actualData[reg.id],
      models: models,
      baseline: baselineData[reg.subId][seasonId]
    }
  })

  // Add model metadata
  console.log('\n Calculating model statistics')

  region.regionData.forEach((reg, regionIdx) => {
    output.regions[regionIdx].models.forEach(model => {
      model.stats = stats.getModelStats(
        cachedCSVs[model.id],
        actualData[reg.id].map(weekData => {
          return {
            week: weekData.week,
            data: weekData.actual
          }
        }),
        reg.subId
      )
    })
  })

  // Separate distributions data from the models.
  // NOTE: This should happen somewhere above, but meh!
  utils.extractDistributions(output).forEach(regionData => {
    // If the season is latest and region is nat, save as `latest-nat`.
    // This chunk will get loaded directly with the main app.
    let outDir = './src/assets/data/distributions'
    let outputFile
    if ((seasons.indexOf(regionData.seasonId) === seasons.length - 1) && (regionData.regionId === 'nat')) {
      outputFile = path.join(outDir, 'season-latest-nat.json')
    } else {
      outputFile = path.join(outDir, `season-${regionData.seasonId}-${regionData.regionId}.json`)
    }
    fs.writeFile(outputFile, JSON.stringify(regionData), err => {
      if (err) {
        throw err
      }
      console.log(` Distributions file written at ${outputFile}`)
    })
  })

  fs.writeFile(seasonOutFile, JSON.stringify(utils.deleteDistributions(output)), (err) => {
    if (err) throw err
    console.log('\n ✓ .json saved at ' + seasonOutFile)
  })
})
