var GridWorld = GridWorld || {},
    AgentRLTD = AgentRLTD || {},
    Maze = Maze || {},
    Vec = Vec || {},
    World = World || {},
    document = document || {};

(function (global) {
    "use strict";

    /**
     * GridWorld Environment
     * @name GridWorld
     * @extends World
     * @constructor
     *
     * @returns {GridWorld}
     */
    function GridWorld() {
        this.rs = {};
        this.trs = {};
        this.tvs = {};
        this.pas = {};
        this.selected = -1;
        this.Rarr = null;
        this.Aarr = null;
        this.sid = -1;
        this.action = null;
        this.state = 0;
        this.stepsPerTick = 1;
        this.nStepsHistory = [];
        this.pause = false;
        this.numItems = 0;

        this.maze = new Maze({
            xCount: 10,
            yCount: 10,
            width: 600,
            height: 600
        });

        this.grid = this.maze.grid;
        this.walls = this.maze.walls;
        this.gH = this.grid.yCount;
        this.gW = this.grid.xCount;
        this.gS = this.grid.yCount * this.grid.xCount;
        this.cs = this.grid.cellWidth;  // cell size
        this.agents = [
            new AgentRLTD(new Vec(50, 50),
                {
                    brainType: 'RLTD',
                    env: Utility.stringify({
                        getNumStates: function () {
                            return 0;
                        },
                        getMaxNumActions: function () {
                            return 4;
                        },
                        startState: function () {
                            return 0;
                        }
                    }),
                    numActions: 4,
                    numStates: 0,
                    numEyes: 0,
                    numTypes: 0,
                    range: 0,
                    proximity: 0,
                    radius: 10,
                    collision: false,
                    interactive: false,
                    useSprite: false,
                    worker: false,
                    cheats: {
                        gridLocation: false,
                        position: false,
                        id: false,
                        name: true
                    }
                })
        ];

        this.initGrid();
        this.drawGrid();
        this.rewards = new FlotGraph(this.agents);

        return this;
    }

    GridWorld.prototype = Object.create(World.prototype);
    GridWorld.prototype.constructor = World;

    /**
     *
     */
    GridWorld.prototype = {
        tick: function () {
            let self = this;
            if (self.sid === -1) {
                self.sid = setInterval(function () {
                    for (let k = 0; k < self.stepsPerTick; k++) {
                        // ask agent for an action
                        let a = self.agents[0].brain.act(self.state),
                        // run it through environment dynamics
                            obs = self.sampleNextState(self.state, a);

                        // allow opportunity for the agent to learn
                        self.agents[0].brain.learn(obs.r);
                        // evolve environment to next state
                        self.state = obs.ns;

                        self.agents[0].nStepsCounter += 1;
                        if (typeof obs.resetEpisode !== 'undefined') {
                            self.agents[0].score += 1;
                            self.agents[0].brain.resetEpisode();

                            self.agents[0].gridLocation = self.grid.getCellAt(0, 0);
                            self.agents[0].pos.set(self.grid.cellWidth / 2, self.grid.cellHeight / 2);
                            self.state = self.startState();

                            // record the reward achieved
                            if (self.agents[0].nStepsHistory.length >= self.agents[0].nflot) {
                                self.agents[0].nStepsHistory = self.agents[0].nStepsHistory.slice(1);
                            }
                            self.agents[0].nStepsHistory.push(self.agents[0].nStepsCounter);
                            self.agents[0].nStepsCounter = 0;
                        } else {
                            self.agents[0].gridLocation = self.grid.getCellAt(self.sToX(self.state), self.sToY(self.state));
                            let x = self.agents[0].gridLocation.coords.bottom.right.x - (self.grid.cellWidth / 2),
                                y = self.agents[0].gridLocation.coords.bottom.right.y - (self.grid.cellHeight / 2);
                            self.agents[0].pos.set(x, y);
                        }
                    }

                    self.drawGrid();
                }, 20);
            } else {
                clearInterval(self.sid);
                self.sid = -1;
            }
        },

        /**
         * Set up the grid world and the actions avail
         */
        reset: function () {
            // specify some rewards
            let Rarr = Utility.zeros(this.gS),
                Aarr = new Array(this.gS),
                lastState = 0;

            for (let y = 0; y < this.gH; y++) {
                for (let x = 0; x < this.gW; x++) {
                    let state = this.xyToS(x, y),
                        actions = this.grid.disconnectedNeighbors(this.grid.getCellAt(x, y)),
                        actionsAvail = {0: null, 1: null, 2: null, 3: null};
                    for (let a = 0; a < actions.length; a++) {
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
                    Aarr[state] = actionsAvail;
                    Rarr[state] = (state === this.gS - 1) ? 1 : 0;
                    let nulled = 0
                    for (let key in actionsAvail) {
                        if (actionsAvail[key] === null) {
                            nulled++;
                        }
                    }
                    if (nulled === 3 && lastState !== 0 && state !== this.gS - 1) {
                        Rarr[state] = -1;
                    }
                    lastState = state;
                }
            }

            this.Rarr = Rarr;
            this.Aarr = Aarr;

            return this;
        },

        /**
         * Get the reward of being in s, taking action a, and ending up in ns
         * @param {number} s
         * @param {number} a
         * @param {number} ns
         * @returns {number}
         */
        reward: function (s, a, ns) {
            let rew = this.Rarr[s];

            return rew;
        },

        /**
         *
         * @param {number} s
         * @param {number} a
         * @returns {number}
         */
        nextStateDistribution: function (s, a) {
            let ns, nx, ny,
                sx = this.sToX(s),
                sy = this.sToY(s);

            if (s === this.gS - 1) {
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
        },

        /**
         * Observe the raw reward of being in s, taking a, and ending up in ns
         * @param {number} s
         * @param {number} a
         * @returns {{ns: (*|Number), r: (*|Number)}}
         */
        sampleNextState: function (s, a) {
            let ns = this.nextStateDistribution(s, a),
                r = this.reward(s, a, ns);

            // every step takes a bit of negative reward
            r -= 0.01;
            let out = {
                ns: ns,
                r: r
            };
            if (s === (this.gS - 1)) {
                // episode is over
                out.resetEpisode = true;
            }

            return out;
        },

        /**
         * Return the number of states
         * @returns {number}
         */
        getNumStates: function () {
            return this.gS;
        },

        /**
         * Return the number of actions
         * @returns {number}
         */
        getMaxNumActions: function () {
            return 4;
        },

        /**
         * Return the allowed actions based on s
         * @returns {Array}
         */
        allowedActions: function (s) {
            let x = this.sToX(s),
                y = this.sToY(s),
                as = [],
                c = this.grid.getCellAt(x, y),
                actions = this.grid.disconnectedNeighbors(c);

            for (let a = 0; a < actions.length; a++) {
                if (actions[a].x === x - 1 && actions[a].y === y) { // Left
                    as.push(0);
                } else if (actions[a].x === x && actions[a].y === y + 1) { // Down
                    as.push(1);
                } else if (actions[a].x === x && actions[a].y === y - 1) { // Up
                    as.push(2);
                } else if (actions[a].x === x + 1 && actions[a].y === y) { // Right
                    as.push(3);
                }
            }

            return as;
        },

        /**
         * Convert the state to an x
         * @param {number} s
         * @returns {number}
         */
        sToX: function (s) {
            return Math.floor(s / this.gW);
        },

        /**
         * Convert the state to a y
         * @param {number} s
         * @returns {number}
         */
        sToY: function (s) {
            return s % this.gH;
        },

        /**
         * Convert an x, y to the state
         * @param {number} x
         * @param {number} y
         * @returns {number}
         */
        xyToS: function (x, y) {
            return x * this.gW + y;
        },

        /**
         * Return a rand state
         * @returns {number}
         */
        randomState: function () {
            return Math.floor(Math.random() * this.gS);
        },

        /**
         * Return the starting state
         * @returns {number}
         */
        startState: function () {
            return 0;
        },

        /**
         *
         * @param s
         */
        cellClicked: function (s) {
            if (s === this.selected) {
                this.selected = -1; // toggle off
                $("#creward").html('(select a cell)');
            } else {
                this.selected = s;
                $("#creward").html(this.Rarr[s].toFixed(2));
                $("#rewardslider").slider('value', this.Rarr[s]);
            }
            this.drawGrid(); // redraw
        },

        /**
         *
         */
        drawGrid: function () {
            let sx = this.sToX(this.state),
                sy = this.sToY(this.state);

            d3.select('#cpos')
                .attr('cx', sx * this.cs + this.cs / 2)
                .attr('cy', sy * this.cs + this.cs / 2);

            // updates the grid with current state of world/agent
            for (let y = 0; y < this.gH; y++) {
                for (let x = 0; x < this.gH; x++) {
                    let xcoord = x * this.cs,
                        ycoord = y * this.cs,
                        r = 255,
                        g = 255,
                        b = 255,
                        s = this.xyToS(x, y),
                        vv = null;

                    // get value of state s under agent policy
                    if (typeof this.agents[0].brain.V !== 'undefined') {
                        vv = this.agents[0].brain.V[s];
                    } else if (typeof this.agents[0].brain.Q !== 'undefined') {
                        let poss = this.allowedActions(s);
                        vv = -1;
                        for (let i = 0, n = poss.length; i < n; i++) {
                            let qsa = this.agents[0].brain.Q[poss[i] * this.gS + s];
                            if (i === 0 || qsa > vv) {
                                vv = qsa;
                            }
                        }
                    }

                    let ms = 100;
                    if (vv > 0) {
                        g = 255;
                        r = 255 - vv * ms;
                        b = 255 - vv * ms;
                    }
                    if (vv < 0) {
                        g = 255 + vv * ms;
                        r = 255;
                        b = 255 + vv * ms;
                    }

                    let vcolor = 'rgb(' + Math.floor(r) + ',' + Math.floor(g) + ',' + Math.floor(b) + ')',
                        rcolor = "";
                    // update colors of rectangles based on value
                    r = this.rs[s];

                    if (s === this.selected) {
                        // highlight selected cell
                        r.attr('fill', '#FF0');
                    } else {
                        r.attr('fill', vcolor);
                    }

                    // write reward texts
                    let rv = this.Rarr[s],
                        tr = this.trs[s];
                    if (rv !== 0) {
                        tr.text('R ' + rv.toFixed(1));
                    }

                    // skip rest for cliff
                    //if (this.T[s] === 1) {continue;}

                    // write value
                    let tv = this.tvs[s];
                    tv.text(vv !== null ? vv.toFixed(2) : 0);

                    // update policy arrows
                    let paa = this.pas[s];
                    for (let a = 0; a < 4; a++) {
                        let pa = paa[a];
                        let prob = this.agents[0].brain.P[a * this.gS + s],
                            nx = 0,
                            ny = 0,
                            actions = this.Aarr[s],
                            avail = actions[a];
                        if (avail === null || prob < 0.01) {
                            pa.attr('visibility', 'hidden');
                        } else {
                            pa.attr('visibility', 'visible');
                        }

                        let ss = this.cs / 2 * prob * 0.9;

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

                        pa.attr('x1', xcoord + (this.cs / 2))
                            .attr('y1', ycoord + (this.cs / 2))
                            .attr('x2', xcoord + (this.cs / 2) + nx)
                            .attr('y2', ycoord + (this.cs / 2) + ny);
                    }
                }
            }
        },

        /**
         *
         */
        initGrid: function () {
            let d3elt = d3.select('#draw');
            this.rs = {};
            this.trs = {};
            this.tvs = {};
            this.pas = {};

            let gh = this.gH, // height in cells
                gw = this.gW, // width in cells
                gs = this.gW * this.gH, // total number of cells
                w = 600,
                h = 600;

            let _this = this;

            d3elt.html('');

            let svg = d3elt.append('svg')
                .attr('width', w)
                .attr('height', h)
                .append('g')
                .attr('transform', 'scale(1)');

            // define a marker for drawing arrowheads
            svg.append("defs").append("marker")
                .attr("id", "arrowhead")
                .attr("refX", 3)
                .attr("refY", 2)
                .attr("markerWidth", 3)
                .attr("markerHeight", 4)
                .attr("orient", "auto")
                .append("path")
                .attr("d", "M 0,0 V 4 L3,2 Z");

            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < gw; x++) {
                    let xcoord = x * this.cs,
                        ycoord = y * this.cs,
                        s = this.xyToS(x, y),
                        g = svg.append('g');

                    // click callback for group
                    g.on('click', function (ss) {
                        return function () {
                            _this.cellClicked(ss);
                        }; // close over s
                    }(s));

                    // set up cell rectangles
                    let r = g.append('rect')
                        .attr('x', xcoord)
                        .attr('y', ycoord)
                        .attr('height', this.cs - 2)
                        .attr('width', this.cs - 2)
                        .attr('fill', '#FFF')
                        .attr('stroke', 'black')
                        .attr('stroke-width', '0.3');
                    this.rs[s] = r;

                    // reward text
                    let tr = g.append('text')
                        .attr('x', xcoord + 5)
                        .attr('y', ycoord + 55)
                        .attr('font-size', 10)
                        .text('');
                    this.trs[s] = tr;

                    // value text
                    let tv = g.append('text')
                        .attr('x', xcoord + 5)
                        .attr('y', ycoord + 20)
                        .text('');
                    this.tvs[s] = tv;

                    // policy arrows
                    this.pas[s] = [];
                    for (let a = 0; a < 4; a++) {
                        this.pas[s][a] = {};
                        let x1, x2, y1, y2, lx1, lx2, ly1, ly2,
                            action = this.Aarr[s][a],
                            buffer = this.cs / 2;
                        switch (a) {
                            case 0: // Left
                                x1 = xcoord + buffer;
                                x2 = xcoord + buffer - (action !== null ? 10 : 0);
                                y1 = ycoord + buffer;
                                y2 = ycoord + buffer;
                                if (action === null) {
                                    lx1 = xcoord;
                                    lx2 = xcoord;
                                    ly1 = ycoord;
                                    ly2 = ycoord + this.cs;
                                }
                                break;
                            case 1: // Down
                                x1 = xcoord + buffer;
                                x2 = xcoord + buffer;
                                y1 = ycoord + buffer;
                                y2 = ycoord + buffer + (action !== null ? 10 : 0);
                                if (action === null) {
                                    lx1 = xcoord;
                                    lx2 = xcoord + this.cs;
                                    ly1 = ycoord + this.cs;
                                    ly2 = ycoord + this.cs;
                                }
                                break;
                            case 2: // Up
                                x1 = xcoord + buffer;
                                x2 = xcoord + buffer;
                                y1 = ycoord + buffer;
                                y2 = ycoord + buffer - (action !== null ? 10 : 0);
                                if (action === null) {
                                    lx1 = xcoord;
                                    lx2 = xcoord + this.cs;
                                    ly1 = ycoord;
                                    ly2 = ycoord;
                                }
                                break;
                            case 3: // Right
                                x1 = xcoord + buffer;
                                x2 = xcoord + buffer + (action !== null ? 10 : 0);
                                y1 = ycoord + buffer;
                                y2 = ycoord + buffer;
                                if (action === null) {
                                    lx1 = xcoord + this.cs;
                                    lx2 = xcoord + this.cs;
                                    ly1 = ycoord;
                                    ly2 = ycoord + this.cs;
                                }
                                break;
                        }

                        let pa = g.append('line')
                            .attr('x1', x1)
                            .attr('y1', y1)
                            .attr('x2', x2)
                            .attr('y2', y2)
                            .attr('stroke', 'black')
                            .attr('stroke-width', '1');
                        if (action !== null) {
                            pa.attr("marker-end", "url(#arrowhead)");
                        }
                        this.pas[s][a] = pa;

                        g.append('line')
                            .attr('x1', lx1 - 1)
                            .attr('y1', ly1 - 1)
                            .attr('x2', lx2 - 1)
                            .attr('y2', ly2 - 1)
                            .attr('stroke', 'red')
                            .attr('stroke-width', '2');
                    }
                }
            }

            // append agent position circle
            svg.append('circle')
                .attr('cx', -100)
                .attr('cy', -100)
                .attr('r', 15)
                .attr('fill', '#FF0')
                .attr('stroke', '#000')
                .attr('id', 'cpos');

        }
    };

    global.GridWorld = GridWorld;

}(this));
