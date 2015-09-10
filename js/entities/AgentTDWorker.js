(function (global) {
    "use strict";

    /**
     * Initialize the AgentSGDT
     * @param {Vec} position
     * @param {Object} env
     * @param {Object} opts
     * @returns {AgentSGDT}
     */
    var AgentTDWorker = function (position, env, opts) {
        Agent.call(this, position, env, opts);

        this.carrot = +5;
        this.stick = -6;

        // The Agent's actions
        this.actions = [];
        this.actions.push([1, 1]);
        this.actions.push([0.8, 1]);
        this.actions.push([1, 0.8]);
        this.actions.push([0.5, 0]);
        this.actions.push([0, 0.5]);

        // The number of possible angles the Agent can turn
        this.numActions = this.actions.length;

        // The number of Agent's eyes, each one sees the number of knownTypes
        this.numStates = this.numEyes * this.numTypes;

        // Amount of temporal memory. 0 = agent lives in-the-moment :)
        this.temporalWindow = 1;

        // Size of the network
        this.networkSize = this.numStates * this.temporalWindow + this.numActions * this.temporalWindow + this.numStates;

        /**
         * The value function network computes a value of taking any of the possible actions
         * given an input state.
         *
         * Here we specify one explicitly the hard way but we could also use
         * opt.hidden_layer_sizes = [20,20] instead to just insert simple relu hidden layers.
         * @type {Array}
         */
        this.layerDefs = [];
        this.layerDefs.push({type: 'input', out_sx: 1, out_sy: 1, out_depth: this.networkSize});
        this.layerDefs.push({type: 'fc', num_neurons: 50, activation: 'relu'});
        this.layerDefs.push({type: 'fc', num_neurons: 50, activation: 'relu'});
        this.layerDefs.push({type: 'regression', num_neurons: this.numActions});

        /**
         * The options for the Temporal Difference learner that trains the above net
         * by backpropping the temporal difference learning rule.
         * @type {Object}
         */
        this.trainerOpts = {
            learning_rate: 0.001,
            momentum: 0.0,
            batch_size: 64,
            l2_decay: 0.01
        };

        /**
         * Options for the Brain
         * @type {Object}
         */
        this.brainOpts = {
            num_states: this.numStates,
            num_actions: this.numActions,
            temporal_window: this.temporalWindow,
            experience_size: 30000,
            start_learn_threshold: 1000,
            gamma: 0.7,
            learning_steps_total: 200000,
            learning_steps_burnin: 3000,
            epsilon_min: 0.05,
            epsilon_test_time: 0.05,
            layer_defs: this.layerDefs,
            tdtrainer_options: this.trainerOpts
        };

        var _this = this;

        this.brain = new Worker('js/entities/TDBrain.js');
        this.brain.onmessage = function (e) {
            var data = e.data;
            switch (data.cmd) {
            case 'init':
                if (data.msg === 'load') {
                    _this.loadMemory();
                }
                if (data.msg === 'complete') {

                }
                break;
            case 'forward':
                if (data.msg === 'complete') {
                    _this.previousActionIdx = _this.actionIndex;
                    _this.actionIndex = data.input;

                    // Demultiplex into behavior variables
                    _this.rot1 = _this.actions[_this.actionIndex][0] * 1;
                    _this.rot2 = _this.actions[_this.actionIndex][1] * 1;
                }
                break;
            case 'backward':
                if (data.msg === 'complete') {

                }
                break;
            case 'getAverage':
                if (data.msg === 'complete') {
                    _this.pts.push(data.input);
                }
                break;
            default:
                console.log('Unknown command: ' + data.cmd + ' message:' + data.msg);
                break;
            }
        };

        this.brain.postMessage({cmd: 'init', input: this.brainOpts});

        return this;
    };

    AgentTDWorker.prototype = Object.create(Agent.prototype);
    AgentTDWorker.prototype.constructor = Agent;

    /**
     * The agent simply behaves in the environment
     * @returns {undefined}
     */
    AgentTDWorker.prototype.act = function (walls, entities, width, height) {
        // Create input to brain
        var inputArray = new Array(this.numEyes * this.numTypes);

        for (var i = 0; i < this.numEyes; i++) {
            var e = this.eyes[i];
            for (var nt = 0; nt < this.numTypes; nt++) {
                inputArray[i * this.numTypes + nt] = 1.0;
                if (e.sensedType !== -1) {
                    // sensedType is 0 for wall, 1 for food and 2 for poison
                    // lets do a 1-of-k encoding into the input array
                    // normalize to [0,1]
                    inputArray[i * this.numTypes + e.sensedType] = e.sensedProximity / e.maxRange;
                }
            }
        }

        // Get action from brain
        this.previousActionIdx = this.actionIndex;
        this.actionIndex = this.brain.forward(inputArray);

        // Demultiplex into behavior variables
        this.rot1 = this.actions[this.actionIndex][0] * 1;
        this.rot2 = this.actions[this.actionIndex][1] * 1;

        // Steer the agent according to outputs of wheel velocities
        var v = new Vec(0, this.radius / 2.0);
        v = v.rotate(this.angle + Math.PI / 2);
        var w1pos = this.position.add(v), // Positions of wheel 1
            w2pos = this.position.sub(v); // Positions of wheel 2
        var vv = this.position.sub(w2pos);
        vv = vv.rotate(-this.rot1);
        var vv2 = this.position.sub(w1pos);
        vv2 = vv2.rotate(this.rot2);
        var newPos = w2pos.add(vv),
            newPos2 = w1pos.add(vv2);

        newPos.scale(0.5);
        newPos2.scale(0.5);

        this.position = newPos.add(newPos2);

        this.angle -= this.rot1;
        if (this.angle < 0) {
            this.angle += 2 * Math.PI;
        }

        this.angle += this.rot2;
        if (this.angle > 2 * Math.PI) {
            this.angle -= 2 * Math.PI;
        }

        // The agent is trying to move from pos to oPos so we need to check walls
        var result = Utility.collisionCheck(this.oldPos, this.position, walls);
        if (result) {
            // The agent derped! Wall collision! Reset their position
            this.position = this.oldPos;
        }

        // Check for food
        // Gather up all the entities nearby based on cell population
        this.digested = [];
        for (var j = 0, n = this.gridLocation.population.length; j < n; j++) {
            var entity = entities.find(Utility.getId, this.gridLocation.population[j]);
            if (entity) {
                var dist = this.position.distFrom(entity.position);
                if (dist < entity.radius + this.radius) {
                    var result = Utility.collisionCheck(this.position, entity.position, walls);
                    if (!result) {
                        // Nom Noms!
                        switch (entity.type) {
                            case 1:// The sweet meats
                                this.digestionSignal += 5.0;
                                break;
                            case 2:// The gnar gnar meats
                                this.digestionSignal += -6.0;
                                break;
                        }
                        this.digested.push(entity);
                    }
                }
            }
        }

        // Get action from brain
        this.brain.postMessage({cmd: 'forward', input: inputArray});
    };

    /**
     * In backward pass agent learns.
     * @returns {undefined}
     */
    AgentTDWorker.prototype.learn = function () {
        // Compute the reward
        var proximityReward = 0.0;
        for (var ei = 0; ei < this.numEyes; ei++) {
            var e = this.eyes[ei];
            // Agents dont like to see walls, especially up close
            proximityReward += e.sensedType === 0 ? e.sensedProximity / e.maxRange : 1.0;
        }

        // Calculate the proximity reward
        proximityReward = proximityReward / this.numEyes;
        proximityReward = Math.min(1.0, proximityReward * 2);

        // Agents like to go straight forward
        var forwardReward = 0.0;
        if (this.actionIndex === 0 && proximityReward > 0.75) {
            forwardReward = 0.1 * proximityReward;
        }
        // Agents like to eat good things
        var digestionReward = this.digestionSignal;
        this.digestionSignal = 0.0;

        var reward = proximityReward + forwardReward + digestionReward;
        // pass to brain for learning
        this.brain.postMessage({cmd: 'backward', input: reward});
    };

    /**
     * Tick the agent
     * @param {Object} smallWorld
     * @returns {undefined}
     */
    AgentTDWorker.prototype.tick = function (smallWorld) {
        this.oldPos = new Vec(this.position.x, this.position.y);
        this.oldAngle = this.angle;

        // Loop through the eyes and check the walls and nearby entities
        for (var ei = 0; ei < this.numEyes; ei++) {
            this.eyes[ei].sense(this, smallWorld.walls, smallWorld.entities);
        }

        // Let the agents behave in the world based on their input
        this.act(smallWorld.walls, smallWorld.entities, smallWorld.width, smallWorld.height);

        // Handle boundary conditions.. bounce agent
        Utility.boundaryCheck(this, smallWorld.width, smallWorld.height);

        this.sprite.rotation = -this.angle;
        this.direction = Utility.getDirection(this.angle);

        // This is where the agents learns based on the feedback of their actions on the environment
        this.learn();

        if (this.digested.length > 0) {
            this.brain.postMessage({cmd: 'getAverage'});
        }

        return this;
    };

    global.AgentTDWorker = AgentTDWorker;

}(this));

