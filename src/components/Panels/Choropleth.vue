<style lang="scss">

.datamaps-subunit {
  cursor: pointer;
}

#choropleth {
  text-align: center;

  #relative-button-title {
    padding-top: 10px;
    text-align: left;
    font-size: 12px;
  }

  #relative-button {
    position: absolute;
    text-align: left;
    font-size: 11px;
    cursor: pointer;
    user-select: none;
    .icon {
      margin: 0px 10px;
    }
    span {
      vertical-align: middle;
      &.disabled {
        color: #aaa;
      }
    }
  }
}

.colorbar-group .axis {
  line, path {
    fill: none;
    stroke: #bbb !important;
  }
}

#selectors {
  .level {
    margin-bottom: 0px;
  }
}

#switch-tooltip {
  padding: 5px 10px;
  ul {
    list-style: disc inside none;
    display: table;

    li {
      display: table-row;
      &::before {
        content: '•';
        display: table-cell;
        text-align: right;
        padding-right: 10px;
      }
    }
  }
}

#choropleth-tooltip {
  padding: 5px 10px;
  .value {
    font-size: 12px;
    font-weight: bold;
  }
}
</style>

<template lang="pug">
div
  // Tooltip over relative toggle switch
  #switch-tooltip.tooltip(
    v-show="tooltips.switch.show"
    v-bind:style="tooltips.switch.pos"
  )
    | {{{ tooltips.switch.text }}}

  // Tooltip for map hover
  #choropleth-tooltip.tooltip
    .value
    .region

  #selectors
    .level.is-mobile
      .level-left
        .level-item
          .heading Week <b>{{ selectedWeekName }}</b>
          span#region-selector.select
              select(v-model="currentRegion")
                option(v-for="region in regions") {{ region }}

      .level-right
        .level-item
          p.heading Season
          p.control.title
            span#season-selector.select.is-small
              select(v-model="currentSeason")
                option(v-for="season in seasons") {{ season }}


  // Main plotting div
  #choropleth
    #relative-button-title
      span Weighted ILI (%)
    #relative-button(
      v-on:click="toggleRelative"
      v-on:mouseover="showSwitchTooltip"
      v-on:mouseout="hideSwitchTooltip"
      v-on:mousemove="moveSwitchTooltip"
    )
      span(v-bind:class="[choroplethRelative ? 'disabled' : '']") Absolute
      span.icon
        i(
          v-bind:class=`[choroplethRelative ? '' : 'fa-rotate-180',
                        'fa fa-toggle-on']`
         )
      span(v-bind:class="[choroplethRelative ? '' : 'disabled']") Relative
</template>

<script>
import Choropleth from '../../choropleth'
import { mapGetters, mapActions } from 'vuex'
import nprogress from 'nprogress'

export default {
  computed: {
    ...mapGetters([
      'seasons',
      'regions',
      'selectedRegionId',
      'selectedSeasonId',
      'metadata'
    ]),
    ...mapGetters('switches', [
      'selectedSeason',
      'selectedRegion',
      'choroplethRelative',
      'showTimeChart',
      'showDistributionChart'
    ]),
    ...mapGetters('weeks', [
      'selectedWeekName'
    ]),
    currentSeason: {
      get () {
        return this.seasons[this.selectedSeason]
      },
      set (val) {
        // Check if we need to download the season
        nprogress.start()
        this.downloadSeasonData({
          http: this.$http,
          id: val,
          success: () => {
            if (this.showDistributionChart) {
              // Check if we need to download dist data
              let distId = `${val}-${this.selectedRegionId}`
              nprogress.start()
              this.downloadDistData({
                http: this.$http,
                id: distId,
                success: () => {
                  this.updateSelectedSeason(this.seasons.indexOf(val))
                  nprogress.done()
                },
                fail: err => console.log(err)
              })
            } else {
              this.updateSelectedSeason(this.seasons.indexOf(val))
              nprogress.done()
            }
          },
          fail: err => console.log(err)
        })
      }
    },
    currentRegion: {
      get () {
        return this.regions[this.selectedRegion]
      },
      set (val) {
        let regionIdx = this.regions.indexOf(val)
        let regionId = this.metadata.regionData[regionIdx].id
        let distId = `${this.selectedSeasonId}-${regionId}`
        if (this.showDistributionChart) {
          // If on distribution chart, check and request for dist data
          nprogress.start()
          this.downloadDistData({
            http: this.$http,
            id: distId,
            success: () => {
              this.updateSelectedRegion(regionIdx)
              nprogress.done()
            },
            fail: err => console.log(err)
          })
        } else {
          this.updateSelectedRegion(regionIdx)
        }
      }
    }
  },
  methods: {
    ...mapActions([
      'importLatestChunk',
      'initChoropleth',
      'plotChoropleth',
      'updateChoropleth',
      'downloadSeasonData',
      'downloadDistData'
    ]),
    ...mapActions('switches', [
      'updateSelectedRegion',
      'updateSelectedSeason',
      'toggleRelative'
    ]),
    showSwitchTooltip () {
      this.tooltips.switch.show = true
    },
    hideSwitchTooltip () {
      this.tooltips.switch.show = false
    },
    moveSwitchTooltip (event) {
      let obj = this.tooltips.switch

      obj.pos.top = (event.clientY + 15) + 'px'
      obj.pos.left = (event.clientX + 15) + 'px'
    }
  },
  data () {
    return {
      tooltips: {
        switch: {
          show: false,
          text: `Choose between
                 <ul>
                 <li><b>Absolute</b> weighted ILI % values or</li>
                 <li><b>Relative</b> values as the percent above/below the<br>
                 regional CDC baseline
                 </ul>`,
          pos: {
            top: '0px',
            left: '0px'
          }
        }
      }
    }
  },
  ready () {
    require.ensure(['../../store/data'], () => {
      this.importLatestChunk(require('../../store/data'))

      this.updateSelectedSeason(this.seasons.length - 1)

      // Setup map
      this.initChoropleth(new Choropleth('choropleth', regionIdx => {
        if (this.showDistributionChart) {
          // If on distribution chart, check and request for dist data
          let regionId = this.metadata.regionData[regionIdx].id
          let distId = `${this.selectedSeasonId}-${regionId}`
          nprogress.start()
          this.downloadDistData({
            http: this.$http,
            id: distId,
            success: () => {
              this.updateSelectedRegion(regionIdx)
              nprogress.done()
            },
            fail: err => console.log(err)
          })
        } else {
          this.updateSelectedRegion(regionIdx)
        }
      }))

      // Setup data
      this.plotChoropleth()

      // Hot start
      this.updateChoropleth()
    })
  }
}
</script>
