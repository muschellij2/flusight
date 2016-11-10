<style lang="scss" scoped>

#intro-tooltip {
    z-index: 900;
    position: fixed;
    top: 0px;
    left: 0px;
    background-color: white;
    padding: 15px 20px;
    box-shadow: 0px 0px 5px;
    border-radius: 2px;
    color: #333;
    font-size: 11px;
    width: 300px;

    #intro-title {
        font-size: 20px;
        font-weight: bold;
        margin-bottom: 10px;
    }

    #intro-content {
        font-size: 13px;
        margin-bottom: 20px;
    }

    .right {
        float: right;
    }
}

#intro-overlay {
    position: fixed;
    top: 0px;
    bottom: 0px;
    left: 0px;
    right: 0px;
    background-color: rgba(0, 0, 0, 0.3);
    z-index: 800;
}

</style>

<template>

    <div id="intro-overlay" v-on:click="moveIntroFinish" v-show="introShow">
    </div>

    <div id="intro-tooltip" v-show="introShow">
        <div id="intro-title">
            {{ currentIntro.title }}
        </div>
        <div id="intro-content" v-html="currentIntro.content">
        </div>
        <div id="intro-buttons">
            <a class="button is-small"
               v-on:click="moveIntroFinish">
                <span class="icon is-small">
                    <i class="fa fa-times"></i>
                </span>
                <span>Finish</span>
            </a>
            <span class="right">
            <a v-bind:class="[introAtFirst ? 'is-disabled' : '', 'button is-info
                 is-small is-outlined']"
               v-on:click="moveIntroBackward">
                <span class="icon is-small">
                    <i class="fa fa-angle-left"></i>
                </span>
                <span>Previous</span>
            </a>
            <a class="button is-info is-small"
               v-on:click="moveIntroForward">
                <span>Next</span>
                <span class="icon is-small">
                    <i class="fa fa-angle-right"></i>
                </span>
            </a>
            </span>
        </div>
    </div>

</template>

<script>
  import {
    currentIntro,
    introAtFirst,
    introShow,
    introStep
  } from '../vuex/getters'

  import {
    moveIntroForward,
    moveIntroBackward,
    moveIntroFinish,
    moveIntroStart
  } from '../vuex/actions'

  export default {
    vuex: {
      getters: {
        currentIntro,
        introAtFirst,
        introShow,
        introStep
      },
      actions: {
        moveIntroForward,
        moveIntroBackward,
        moveIntroFinish,
        moveIntroStart
      }
    },
    methods: {
      demoStep(data) {
        let tooltip = this.$d3.select('#intro-tooltip')
        let tooltipBB = tooltip.node().getBoundingClientRect()

        if (data.element === '') {
          let xPos = (window.innerWidth - tooltipBB.width) / 2
          let yPos = (window.innerHeight - tooltipBB.height) / 2

          tooltip.transition()
            .duration(200)
            .style('top', yPos + 'px')
            .style('left', xPos + 'px')
        } else {
          let target = this.$d3.select(data.element)
          let targetBB = target.node().getBoundingClientRect()

          // Highlight current div
          target.style('z-index', '850')

          let yPos = targetBB.top

          if (data.direction === 'left') {
            tooltip.transition()
              .duration(200)
              .style('top', yPos + 'px')
              .style('left', (targetBB.left - tooltipBB.width - 20) + 'px')
          } else {
            tooltip.transition()
              .duration(200)
              .style('top', yPos + 'px')
              .style('left', (targetBB.left + targetBB.width + 20) + 'px')
          }
        }
      },
      setLastElement(el) {
        this.lastElement = el
      }
    },
    ready() {
      this.demoStep(this.currentIntro)
      this.moveIntroFinish()

      // Check for first run
      // Trigger intro
      if
      (document.cookie.replace(/(?:(?:^|.*;\s*)firstRun\s*\=\s*([^;]*).*$)|^.*$/,
                               "$1") !== "true") {
        document.cookie = "firstRun=true; expires=Fri, 31 Dec 9999 23:59:59 GMT"
        this.moveIntroStart()
      }
    },
    data() {
      return {
        lastElement: ''
      }
    },
    watch: {
      introStep: function() {
        this.demoStep(this.currentIntro)
        // Un-highlight previous div
        if (this.lastElement != '') {
          this.$d3.select(this.lastElement)
            .style('z-index', null)
        }

        // Save current as last element
        this.setLastElement(this.currentIntro.element)
      }
    }
  }
</script>