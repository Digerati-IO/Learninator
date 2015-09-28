(function (global) {
    "use strict";

    /**
     * An agent is in state0 and does action0 environment then assigns reward0
     * and provides the new state state1
     * Experience nodes store all this information, which is used in the Q-learning update step
     * @param {Number} state0
     * @param {Number} action0
     * @param {Number} reward0
     * @param {Number} state1
     * @returns {undefined}
     */
    var Experience = function (state0, action0, reward0, state1) {
        this.state0 = state0;
        this.action0 = action0;
        this.reward0 = reward0;
        this.state1 = state1;

        return this;
    };

    /**
     * A Brain object does all the magic.
     * Over time it receives some inputs and some rewards and its job is to set
     * the outputs to maximize the expected reward
     * @param {Object} opts
     * @returns {Brain}
     */
    var TDBrain = function (opts) {
        // in number of time steps, of temporal memory
        // the ACTUAL input to the net will be (x,a) temporalWindow times, and followed by current x
        // so to have no information from previous time step going into value function, set to 0.
        this.temporalWindow = Utility.getOpt(opts, 'temporalWindow', 1);
        // size of experience replay memory
        this.experienceSize = Utility.getOpt(opts, 'experienceSize', 30000);
        // number of examples in experience replay memory before we begin learning
        this.startLearnThreshold = Utility.getOpt(opts, 'startLearnThreshold', Math.floor(Math.min(this.experienceSize * 0.1, 1000)));
        // gamma is a crucial parameter that controls how much plan-ahead the agent does. In [0,1]
        this.gamma = Utility.getOpt(opts, 'gamma', 0.8);

        // number of steps we will learn for
        this.learningStepsTotal = Utility.getOpt(opts, 'learningStepsTotal', 100000);
        // how many steps of the above to perform only random actions (in the beginning)?
        this.learningStepsBurnin = Utility.getOpt(opts, 'learningStepsBurnin', 3000);
        // what epsilon value do we bottom out on? 0.0 => purely deterministic policy at end
        this.epsilonMin = Utility.getOpt(opts, 'epsilonMin', 0.05);
        // what epsilon to use at test time? (i.e. when learning is disabled)
        this.epsilonTestTime = Utility.getOpt(opts, 'epsilonTestTime', 0.01);

        this.numStates = Utility.getOpt(opts, 'numStates', 9 * 3);
        this.numActions = Utility.getOpt(opts, 'numActions', 5);

        // advanced feature. Sometimes a random action should be biased towards some values
        // for example in flappy bird, we may want to choose to not flap more often
        if (typeof opts.randomActionDistribution !== 'undefined') {
            // this better sum to 1 by the way, and be of length this.numActions
            this.randomActionDistribution = opts.randomActionDistribution;
            if (this.randomActionDistribution.length !== this.numActions) {
                console.log('TROUBLE. randomActionDistribution should be same length as numActions.');
            }
            var a = this.randomActionDistribution,
                s = 0.0;
            for (let k = 0; k < a.length; k++) {
                s += a[k];
            }
            if (Math.abs(s - 1.0) > 0.0001) {
                console.log('TROUBLE. randomActionDistribution should sum to 1!');
            }
        } else {
            this.randomActionDistribution = [];
        }

        // states that go into neural net to predict optimal action look as
        // x0,a0,x1,a1,x2,a2,...xt
        // this variable controls the size of that temporal window. Actions are
        // encoded as 1-of-k hot vectors
        this.netInputs = this.numStates * this.temporalWindow + this.numActions * this.temporalWindow + this.numStates;

        // must be at least 2, but if we want more context even more
        this.windowSize = Math.max(this.temporalWindow, 2); // must be at least 2, but if we want more context even more
        this.stateWindow = new Array(this.windowSize);
        this.actionWindow = new Array(this.windowSize);
        this.rewardWindow = new Array(this.windowSize);
        this.netWindow = new Array(this.windowSize);

        // create [state -> value of all possible actions] modeling net for the value function
        var layerDefs = [];
        if (typeof opts.layerDefs !== 'undefined') {
            // this is an advanced usage feature, because size of the input to the network, and number of
            // actions must check out. This is not very pretty Object Oriented programming but I can't see
            // a way out of it :(
            layerDefs = opts.layerDefs;
            if (layerDefs.length < 2) {
                console.log('TROUBLE! must have at least 2 layers');
            }
            if (layerDefs[0].type !== 'input') {
                console.log('TROUBLE! first layer must be input layer!');
            }
            if (layerDefs[layerDefs.length - 1].type !== 'regression') {
                console.log('TROUBLE! last layer must be input regression!');
            }
            if (layerDefs[0].outDepth * layerDefs[0].outSx * layerDefs[0].outSy !== this.netInputs) {
                console.log('TROUBLE! Number of inputs must be numStates * temporalWindow + numActions * temporalWindow + numStates!');
            }
            if (layerDefs[layerDefs.length - 1].numNeurons !== this.numActions) {
                console.log('TROUBLE! Number of regression neurons should be numActions!');
            }
        } else {
            // create a very simple neural net by default
            layerDefs.push({
                type: 'input', 
                outSx: 1, 
                outSy: 1, 
                outDepth: this.netInputs
            });
            if (typeof opts.hiddenLayerSizes !== 'undefined') {
                // allow user to specify this via the option, for convenience
                var hl = opts.hiddenLayerSizes;
                for (var q = 0; q < hl.length; q++) {
                    layerDefs.push({
                        type: 'fc',
                        numNeurons: hl[q],
                        activation: 'relu'
                    }); // relu by default
                }
            }
            layerDefs.push({
                type: 'regression',
                numNeurons: this.numActions
            }); // value function output
        }
        this.valueNet = new convnetjs.Net();
        this.valueNet.makeLayers(layerDefs);

        // and finally we need a Temporal Difference Learning trainer!
        var tdTrainerOptions = {
            learningRate: 0.01,
            momentum: 0.0,
            batchSize: 64,
            l2Decay: 0.01
        };
        if (typeof opts.tdTrainerOptions !== 'undefined') {
            tdTrainerOptions = opts.tdTrainerOptions; // allow user to overwrite this
        }
        this.tdTrainer = new convnetjs.SGDTrainer(this.valueNet, tdTrainerOptions);
        // controls exploration exploitation trade off. Should be annealed over time
        this.epsilon = Utility.getOpt('epsilon', 1.0);
        // experience replay
        this.experience = [];

        // various housekeeping variables
        this.age = 0; // incremented every backward()
        this.forwardPasses = 0; // incremented every forward()
        this.latestReward = 0;
        this.lastInputArray = [];
        this.averageRewardWindow = new Window(1000, 10);
        this.averageLossWindow = new Window(1000, 10);
        this.learning = true;
    };

    /**
     *
     * @type {{randomAction: Function, policy: Function, getNetInput: Function, forward: Function, backward: Function}}
     */
    TDBrain.prototype = {
        /**
         * Returns a random action
         * In the future we can set some actions to be more or less likely
         * at "rest"/default state.
         * @returns {Number}
         */
        randomAction: function () {
            if (this.randomActionDistribution.length === 0) {
                return Utility.randi(0, this.numActions);
            } else {
                // okay, lets do some fancier sampling:
                var p = Utility.randf(0, 1.0),
                    cumprob = 0.0;
                for (var k = 0; k < this.numActions; k++) {
                    cumprob += this.randomActionDistribution[k];
                    if (p < cumprob) {
                        return k;
                    }
                }
            }
        },
        /**
         * Compute the value of doing any action in this state and return the
         * argmax action and its value
         * @param {type} s
         * @returns {Brain_L3.Brain.prototype.policy.BrainAnonym$0}
         */
        policy: function (s) {
            var svol = new convnetjs.Vol(1, 1, this.netInputs);
            svol.w = s;

            var action_values = this.valueNet.forward(svol),
                maxk = 0,
                maxval = action_values.w[0];
            for (var k = 1; k < this.numActions; k++) {
                if (action_values.w[k] > maxval) {
                    maxk = k;
                    maxval = action_values.w[k];
                }
            }

            return {
                action: maxk,
                value: maxval
            };
        },
        /**
         * Return s = (x,a,x,a,x,a,xt) state vector.
         * It's a concatenation of last windowSize (x,a) pairs and current state x
         * @param {type} xt
         * @returns {Array|@exp;Array}
         */
        getNetInput: function (xt) {
            var w = [];
            w = w.concat(xt); // start with current state
            // and now go backwards and append states and actions from history temporalWindow times
            var n = this.windowSize;
            for (var k = 0; k < this.temporalWindow; k++) {
                // state
                w = w.concat(this.stateWindow[n - 1 - k]);
                // action, encoded as 1-of-k indicator vector. We scale it up a bit because
                // we dont want weight regularization to undervalue this information, as it only exists once
                var action1ofk = new Array(this.numActions);
                for (var q = 0; q < this.numActions; q++) {
                    action1ofk[q] = 0.0;
                }
                action1ofk[this.actionWindow[n - 1 - k]] = 1.0 * this.numStates;
                w = w.concat(action1ofk);
            }
            return w;
        },
        /**
         * Compute forward (behavior) pass given the input neuron signals from body
         * @param {Array} input_array
         * @returns {Number|maxact.action}
         */
        forward: function (input_array) {
            this.forwardPasses += 1;
            this.lastInputArray = input_array; // back this up

            // create network input
            var action;
            if (this.forwardPasses > this.temporalWindow) {
                // we have enough to actually do something reasonable
                var net_input = this.getNetInput(input_array);
                if (this.learning) {
                    // compute epsilon for the epsilon-greedy policy
                    this.epsilon = Math.min(1.0, Math.max(this.epsilonMin, 1.0 - (this.age - this.learningStepsBurnin) / (this.learningStepsTotal - this.learningStepsBurnin)));
                } else {
                    this.epsilon = this.epsilonTestTime; // use test-time value
                }
                var rf = Utility.randf(0, 1);
                if (rf < this.epsilon) {
                    // choose a random action with epsilon probability
                    action = this.randomAction();
                } else {
                    // otherwise use our policy to make decision
                    var maxact = this.policy(net_input);
                    action = maxact.action;
                }
            } else {
                // pathological case that happens first few iterations
                // before we accumulate windowSize inputs
                var net_input = [];
                action = this.randomAction();
            }

            // remember the state and action we took for backward pass
            this.netWindow.shift();
            this.netWindow.push(net_input);
            this.stateWindow.shift();
            this.stateWindow.push(input_array);
            this.actionWindow.shift();
            this.actionWindow.push(action);

            return action;
        },
        /**
         *
         * @param {Number} reward
         * @returns {undefined}
         */
        backward: function (reward) {
            this.latestReward = reward;
            this.averageRewardWindow.add(reward);
            this.rewardWindow.shift();
            this.rewardWindow.push(reward);

            if (!this.learning) {
                return;
            }

            // various book-keeping
            this.age += 1;

            // it is time t+1 and we have to store (s_t, a_t, r_t, s_{t+1}) as new experience
            // (given that an appropriate number of state measurements already exist, of course)
            if (this.forwardPasses > this.temporalWindow + 1) {
                var e = new Experience(),
                    n = this.windowSize;
                e.state0 = this.netWindow[n - 2];
                e.action0 = this.actionWindow[n - 2];
                e.reward0 = this.rewardWindow[n - 2];
                e.state1 = this.netWindow[n - 1];
                if (this.experience.length < this.experienceSize) {
                    this.experience.push(e);
                } else {
                    // replace. finite memory!
                    var ri = Utility.randi(0, this.experienceSize);
                    this.experience[ri] = e;
                }
            }

            // learn based on experience, once we have some samples to go on
            // this is where the magic happens...
            if (this.experience.length > this.startLearnThreshold) {
                var avcost = 0.0;
                for (var k = 0; k < this.tdTrainer.batchSize; k++) {
                    var re = Utility.randi(0, this.experience.length),
                        ex = this.experience[re],
                        x = new convnetjs.Vol(1, 1, this.netInputs);
                    x.w = ex.state0;
                    var maxact = this.policy(ex.state1),
                        r = ex.reward0 + this.gamma * maxact.value,
                        yStruct = {
                            dim: ex.action0,
                            val: r
                        },
                        loss = this.tdTrainer.train(x, yStruct);
                    avcost += loss.loss;
                }
                avcost = avcost / this.tdTrainer.batchSize;
                this.averageLossWindow.add(avcost);
            }

            return this;
        }
    };

    var _TDBrain;

    self.onmessage = function (e) {
        var data = e.data;
        switch (data.target) {
            case 'TD':
                switch (data.cmd) {
                    case 'init':
                        importScripts(
                            '../lib/external/convnet.js',
                            '../lib/Utility.js',
                            '../lib/Window.js'
                        );
                        _TDBrain = new TDBrain(data.input);
                        self.postMessage({
                            cmd: 'init',
                            msg: 'complete'
                        });
                        break;
                    case 'load':
                        _TDBrain.valueNet.fromJSON(JSON.parse(data.input));
                        _TDBrain.learning = false;
                        self.postMessage({
                            cmd: 'load',
                            msg: 'complete'
                        });
                        break;
                    case 'act':
                        var actionIndex = _TDBrain.forward(data.input);
                        self.postMessage({
                            cmd: 'act',
                            msg: 'complete',
                            input: actionIndex
                        });
                        break;
                    case 'learn':
                        _TDBrain.backward(data.input);

                        // return the Average reward
                        var avg = _TDBrain.averageRewardWindow.getAverage().toFixed(1);
                        self.postMessage({
                            cmd: 'learn',
                            msg: 'complete',
                            input: avg
                        });
                        break;
                    case 'stop':
                        self.postMessage({
                            cmd: 'stop',
                            msg: 'complete'
                        });
                        close(); // Terminates the worker.
                        break;
                    default:
                        self.postMessage({
                            cmd: 'error',
                            msg: 'Unknown command: ' + data.cmd
                        });
                }
                break;
        }
    };

    global.TDBrain = TDBrain;

})
(this);

