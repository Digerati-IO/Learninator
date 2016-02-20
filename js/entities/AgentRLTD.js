(function (global) {
    "use strict";

    class AgentRLTD extends Agent {
        /**
         * Initialize the AgentRLTD
         * @name AgentRLTD
         * @extends Agent
         * @constructor
         *
         * @param {Vec} position - The x, y location
         * @param {agentOpts} opts - The Agent options
         * @returns {AgentRLTD}
         */
        constructor(position, opts) {
            super(position, opts);
            this.nStepsHistory = [];
            this.nStepsCounter = 0;
            this.nflot = 1000;
            this.score = 0;

            this.brainOpts = Utility.getOpt(opts, 'spec', {
                update: 'qlearn', // 'qlearn' or 'sarsa'
                gamma: 0.9, // discount factor, [0, 1)
                epsilon: 0.2, // initial epsilon for epsilon-greedy policy, [0, 1)
                alpha: 0.1, // value function learning rate
                lambda: 0.9, // eligibility trace decay, [0,1). 0 = no eligibility traces
                replacingTraces: true, // use replacing or accumulating traces
                planN: 50, // number of planning steps per iteration. 0 = no planning
                smoothPolicyUpdate: true, // non-standard, updates policy smoothly to follow max_a Q
                beta: 0.1 // learning rate for smooth policy update
            });

            this.reset();
        }

        reset() {
            let self = this;
            if (!self.worker) {
                self.brain = new TDAgent(self.env, self.brainOpts);
                self.state = self.env.startState();

                self.env.reset();

                return self;
            } else {
                self.post = function (cmd, input) {
                    self.brain.postMessage({target: 'TD', cmd: cmd, input: input});
                };

                let jEnv = Utility.stringify(self.env),
                    jOpts = Utility.stringify(self.brainOpts);

                self.brain = new Worker('js/lib/external/rl.js');
                self.brain.onmessage = function (e) {
                    let data = e.data;
                    switch (data.cmd) {
                        case 'init':
                            if (data.msg === 'complete') {
                                self.state = self.env.startState();

                                self.env.reset();
                            }
                            break;
                        case 'act':
                            if (data.msg === 'complete') {
                                // run it through environment dynamics
                                var obs = self.sampleNextState(self.state, data.input);

                                // allow opportunity for the agent to learn
                                self.brain.postMessage({cmd: 'learn', input: obs.r});
                            }
                            break;
                        case 'learn':
                            if (data.msg === 'complete') {
                                self.Rarr[self.state] = obs.r;

                                // evolve environment to next state
                                self.state = obs.ns;
                                self.gridLocation = self.world.grid.getCellAt(self.sToX(self.state), self.sToY(self.state));

                                let x = self.gridLocation.coords.bottom.right.x - (self.world.grid.cellWidth / 2),
                                    y = self.gridLocation.coords.bottom.right.y - (self.world.grid.cellHeight / 2);
                                self.pos.set(x, y);

                                self.nStepsCounter += 1;
                                if (typeof obs.resetEpisode !== 'undefined') {
                                    self.score += 1;
                                    self.brain.postMessage({cmd: 'resetEpisode'});
                                    // record the reward achieved
                                    if (self.nStepsHistory.length >= self.nflot) {
                                        self.nStepsHistory = self.nStepsHistory.slice(1);
                                    }
                                    self.nStepsHistory.push(self.nStepsCounter);
                                    self.nStepsCounter = 0;

                                    self.gridLocation = self.world.grid.getCellAt(0, 0);
                                    self.pos.set(self.world.grid.cellWidth / 2, self.world.grid.cellHeight / 2);
                                }
                            }
                            break;
                        default:
                            console.log('Unknown command: ' + data.cmd + ' message:' + data.msg);
                            break;
                    }
                };

                self.brain.post('init', {env: jEnv, opts: jOpts});
            }
        }

        /**
         * Agent's chance to act on the world
         * @param {Object} world
         */
        tick(world) {
            this.world = world;
            if (!this.worker) {
                // ask agent for an action
                let a = this.brain.act(this.state),
                // run it through environment dynamics
                    obs = this.sampleNextState(this.state, a);

                // allow opportunity for the agent to learn
                this.brain.learn(obs.r);
                this.Rarr[this.state] = obs.r;

                // evolve environment to next state
                this.state = obs.ns;
                this.gridLocation = this.world.grid.getCellAt(this.sToX(this.state), this.sToY(this.state));

                let x = this.gridLocation.coords.bottom.right.x - (this.world.grid.cellWidth / 2),
                    y = this.gridLocation.coords.bottom.right.y - (this.world.grid.cellHeight / 2);
                this.pos.set(x, y);

                this.nStepsCounter += 1;
                if (typeof obs.resetEpisode !== 'undefined') {
                    this.score += 1;
                    this.brain.resetEpisode();
                    // record the reward achieved
                    if (this.nStepsHistory.length >= this.nflot) {
                        this.nStepsHistory = this.nStepsHistory.slice(1);
                    }
                    this.nStepsHistory.push(this.nStepsCounter);
                    this.nStepsCounter = 0;

                    this.gridLocation = this.world.grid.getCellAt(0, 0);
                    this.pos.set(this.world.grid.cellWidth / 2, this.world.grid.cellHeight / 2);
                }
            } else {
                this.post('act', this.state);
            }
        }
    }

    global.AgentRLTD = AgentRLTD;

}(this));

