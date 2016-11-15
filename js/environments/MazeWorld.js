(function(global) {
  "use strict";

  class MazeWorld extends GameWorld {

    /**
     * World object contains many agents and walls and food and stuff
     * @name MazeWorld
     * @extends GameWorld
     * @constructor
     *
     * @return {MazeWorld}
     */
    constructor(agents = [], walls = [], options = worldOpts) {
      super(agents, walls, options);

      this.selected = -1;
      this.Rarr = null;
      this.Aarr = null;
      this.sid = -1;
      this.action = null;
      this.state = 0;
      this.stepsPerTick = 1;
      this.nStepsHistory = [];
      this.pause = false;

      this.addWalls();
      this.addEntities();

      Agent.prototype.onMouseDown = (event) => {
        this.data = event.data;
        this.isDown = true;
        this.alpha = 1;

        return this;
      };

      Agent.prototype.tick = () => {
        if (this.sid === -1) {
          this.sid = setInterval(() => {
            for (let k = 0; k < this.stepsPerTick; k++) {
              this.updatePopulation();
              // ask agent for an action
              let agent = this.agents[0],
                  state = this.state,
                  a = agent.brain.act(state),
                  // run it through environment dynamics
                  obs = this.sampleNextState(state, a);
              // evolve environment to next state
              this.state = obs.ns;

              agent.nStepsCounter += 1;
              if (typeof obs.resetEpisode !== 'undefined') {
                agent.score += 1;
                agent.brain.resetEpisode();
                this.state = this.startState();

                // record the reward achieved
                if (agent.nStepsHistory.length >= agent.nflot) {
                  agent.nStepsHistory = agent.nStepsHistory.slice(1);
                }
                agent.nStepsHistory.push(agent.nStepsCounter);
                agent.nStepsCounter = 0;
              }

              agent.gridLocation = this.grid.getCellAt(this.sToX(this.state), this.sToY(this.state));
              agent.position = agent.gridLocation.center;
              agent.draw();

              // Check them for collisions
              this.check(agent);

              // Loop through the eyes and check the walls and nearby entities
              for (let ae = 0, ne = agent.numEyes; ae < ne; ae++) {
                this.check(agent.eyes[ae]);
              }

              // Just testing if throwing items at it and +/- rewards for
              // them will distract the agent
              if (agent.collisions.length > 0) {
                for (let c = 0; c < agent.collisions.length; c++) {
                  let col = agent.collisions[c];
                  if (col.entity.type === 1) {
                    obs.r += 0.1;
                  } else if (col.entity.type === 2) {
                    obs.r -= 0.1;
                  }
                  this.deleteEntity(col.entity.id);
                }
              }
              // allow opportunity for the agent to learn
              agent.brain.learn(obs.r);

              for (let [id, entity] of this.population.entries()) {
                if (entity.type !== 0 && entity.type !== 4) {
                  // Check them for collisions
                  this.check(entity);

                  // Tick them
                  entity.tick();
                }
                entity.draw();
              }
              this.drawGrid();
            }
          }, 20);
        } else {
          clearInterval(this.sid);
          this.sid = -1;
        }
      };

      return this;
    }

    /**
     * Draw the Grid
     */
    drawGrid() {
      let agent = this.agents[0],
        l = this.grid.cells.length;

      for (let s = 0; s < l; s++) {
        let cell = this.grid.cells[s],
          rd = 255,
          g = 255,
          b = 255,
          vv = null;

        // get value of state s under agent policy
        if (typeof agent.brain.V !== 'undefined') {
          vv = agent.brain.V[s];
        } else if (typeof agent.brain.Q !== 'undefined') {
          let poss = this.allowedActions(s);
          vv = -1;
          for (let i = 0, n = poss.length; i < n; i++) {
            let qsa = agent.brain.Q[poss[i] * l + s];
            if (i === 0 || qsa > vv) {
              vv = qsa;
            }
          }
        }

        let ms = 10000;
        if (vv > 0) {
          g = 255;
          rd = 255 - (vv * ms);
          b = 255 - (vv * ms);
        }
        if (vv < 0) {
          g = 255 + (vv * ms);
          rd = 255;
          b = 255 + (vv * ms);
        }

        cell.color = Utility.rgbToHex(rd, g, b);
        // Write the reward value text
        cell.reward = this.Rarr[s];
        // Write the value text
        cell.value = vv;
        cell.draw();

        // update policy arrows
        for (let a = 0; a < 4; a++) {
          let prob = agent.brain.P[a * l + s],
            nx = 0,
            ny = 0,
            actions = this.Aarr[s],
            avail = actions[a];
          if (avail === null || prob < 0.01) {
            // Hide the arrow
          } else {
            // Show the arrow
          }

          // The length of the arrow based on experience
          let ss = this.grid.cellSize / 2 * (prob * 0.9);

          switch (a) {
            case 0: // Left
              nx = -ss;
              ny = 0;
              break;
            case 1: // Down
              nx = 0;
              ny = ss;
              break;
            case 2: // Up
              nx = 0;
              ny = -ss;
              break;
            case 3: // Right
              nx = ss;
              ny = 0;
              break;
          }
          // Draw the arrow using below as guide
          cell.graphics.lineStyle(2, 0x000000);
          cell.graphics.beginFill(0x000000);
          cell.graphics.moveTo(cell.center.x - nx, cell.center.y - ny);
          cell.graphics.lineTo(cell.center.x + nx, cell.center.y + ny);
          cell.graphics.endFill();
        }
      }
      this.renderer.render(this.stage);
    }

    /**
     * zip rewards into flot data
     * @return {Array}
     */
    getFlotRewards() {
      let res = [];
      for (let i = 0, n = this.agents[0].nStepsHistory.length; i < n; i++) {
        res.push([i, this.agents[0].nStepsHistory[i]]);
      }
      return res;
    }

    /**
     * Initialize the Flot class
     */
    initFlot() {
      this.container = document.getElementById('flotreward');
      // flot stuff
      this.nflot = 1000;
      this.smoothRewardHistory = [];
      this.smoothReward = [];
      this.flott = [];
      this.series = [];

      for (var a = 0; a < this.agents.length; a++) {
        this.smoothReward[a] = null;
        this.smoothRewardHistory[a] = null;
        this.flott[a] = 0;
        this.smoothRewardHistory[a] = [];
        this.series[a] = {
          data: this.getFlotRewards(a),
          lines: {
            fill: true
          },
          color: a,
          label: this.agents[a].name
        };
      }

      this.plot = $.plot(this.container, this.series, {
        grid: {
          borderWidth: 1,
          minBorderMargin: 20,
          labelMargin: 10,
          backgroundColor: {
            colors: ["#FFF", "#e4f4f4"]
          },
          margin: {
            top: 10,
            bottom: 10,
            left: 10
          }
        },
        xaxis: {
          min: 0,
          max: this.nflot
        },
        yaxis: {
          min: 0,
          max: 1000
        }
      });

      setInterval(() => {
        this.series[0].data = this.getFlotRewards();
        this.plot.setData(this.series);
        this.plot.draw();
      }, 100);
    }

  }

  /**
   * Return the allowed actions based on the current state/cell
   * @param {number} s - State
   * @return {Array}
   */
  MazeWorld.prototype.allowedActions = function(s) {
    let x = this.sToX(s),
        y = this.sToY(s),
        as = [],
        // neighbors = this.grid.cells[s].neighbors,
        actions = this.grid.disconnectedNeighbors(this.grid.getCellAt(x, y));

    for (let a = 0; a < actions.length; a++) {
      if (actions[a] && actions[a].x === x - 1 && actions[a].y === y) { // Left
        as.push(0);
      } else if (actions[a] && actions[a].x === x && actions[a].y === y + 1) { // Down
        as.push(1);
      } else if (actions[a] && actions[a].x === x && actions[a].y === y - 1) { // Up
        as.push(2);
      } else if (actions[a] && actions[a].x === x + 1 && actions[a].y === y) { // Right
        as.push(3);
      }
    }

    return as;
  };

  /**
   * Return the number of actions
   * @return {Number}
   */
  MazeWorld.prototype.getMaxNumActions = function() {
    return this.grid.startCell.directions.length;
  };

  /**
   * Return the number of states
   * @return {Number}
   */
  MazeWorld.prototype.getNumStates = function() {
    return this.grid.cells.length;
  };

  /**
   *
   * @param {Number} s
   * @param {Number} a
   * @return {Number}
   */
  MazeWorld.prototype.nextStateDistribution = function(s, a) {
    let ns, nx, ny,
        sx = this.sToX(s),
        sy = this.sToY(s);

    if (s === this.grid.cells.length - 1) {
      ns = this.startState();
      while (this.Aarr[ns][a] === null) {
        ns = this.randomState();
      }
    } else {
      switch (a) {
        case 0: // Left
          nx = sx - 1;
          ny = sy;
          break;
        case 1: // Down
          nx = sx;
          ny = sy + 1;
          break;
        case 2: // Up
          nx = sx;
          ny = sy - 1;
          break;
        case 3: // Right
          nx = sx + 1;
          ny = sy;
          break;
      }

      if (nx < 0) {
        nx = 0;
      }

      if (ny < 0) {
        ny = 0;
      }

      ns = this.xyToS(nx, ny);
      if (this.Aarr[s][a] !== ns) {
        // Not a valid option so go back to s
        ns = s;
      }
    }

    return ns;
  };

  /**
   * Return a rand state
   * @return {Number}
   */
  MazeWorld.prototype.randomState = function() {
    return Math.floor(Math.random() * this.grid.cells.length);
  };

  /**
   * Set up the grid world and the actions avail
   */
  MazeWorld.prototype.reset = function() {
    let lastState = 0;
    // specify some rewards
    this.Rarr = Utility.Maths.zeros(this.grid.cells.length);
    this.Aarr = new Array(this.grid.cells.length);

    for (let x = 0; x < this.grid.xCount; x++) {
      for (let y = 0; y < this.grid.yCount; y++) {
        let state = this.xyToS(x, y),
            cell = this.grid.getCellAt(x, y),
            actions = this.grid.disconnectedNeighbors(cell),
            actionsAvail = {0: null, 1: null, 2: null, 3: null},
            nulled = 0;
        for (let a = 0; a < actions.length; a++) {
          if (actions[a]) {
            let action = actions[a],
                actionState = this.xyToS(action.x, action.y);
            if (action.x === x - 1 && action.y === y) {
              actionsAvail[0] = actionState;
            } else if (action.x === x && action.y === y + 1) {
              actionsAvail[1] = actionState;
            } else if (action.x === x && action.y === y - 1) {
              actionsAvail[2] = actionState;
            } else if (action.x === x + 1 && action.y === y) {
              actionsAvail[3] = actionState;
            }
          }
        }
        this.Aarr[state] = actionsAvail;
        this.Rarr[state] = (state === this.grid.cells.length - 1) ? 1 : 0;

        for (let key in actionsAvail) {
          if (actionsAvail[key] === null) {
            nulled++;
          }
        }
        if (nulled === 3 && lastState !== 0 && state !== this.grid.cells.length - 1) {
          this.Rarr[state] = -1;
        }
        lastState = state;
      }
    }

    return this;
  };

  /**
   * Get the reward of being in s, taking action a, and ending up in ns
   * @param {Number} s
   * @param {Number} a
   * @param {Number} ns
   * @return {Number}
   */
  MazeWorld.prototype.reward = function(s, a, ns) {
    return this.Rarr[s];
  };

  /**
   * Convert the state to an x
   * @param {Number} s
   * @return {Number}
   */
  MazeWorld.prototype.sToX = function(s) {
    return Math.floor(s / this.grid.xCount);
  };

  /**
   * Convert the state to a y
   * @param {Number} s
   * @return {Number}
   */
  MazeWorld.prototype.sToY = function(s) {
    return s % this.grid.yCount;
  };

  /**
   * Convert an x, y to the state
   * @param {Number} x
   * @param {Number} y
   * @return {Number}
   */
  MazeWorld.prototype.xyToS = function(x, y) {
    return x * this.grid.xCount + y;
  };

  /**
   * Observe the raw reward of being in s, taking a, and ending up in ns
   * @param {Number} s
   * @param {Number} a
   * @return {{ns: (*|Number), r: (*|Number)}}
   */
  MazeWorld.prototype.sampleNextState = function(s, a) {
    let ns = this.nextStateDistribution(s, a),
        r = this.reward(s, a, ns);

    // every step takes a bit of negative reward
    r -= 0.01;
    let out = {
      ns: ns,
      r: r
    };
    if (s === (this.grid.cells.length - 1)) {
      // episode is over
      out.resetEpisode = true;
    }

    return out;
  };

  /**
   * Return the starting state
   * @return {Number}
   */
  MazeWorld.prototype.startState = function() {
    return 0;
  };

  global.MazeWorld = MazeWorld;

}(this));
