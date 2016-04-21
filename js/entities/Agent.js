(function (global) {
    "use strict";

    class Agent extends Entity {

        /**
         * Options for the Agent
         * @typedef {Object} agentOpts
         * @property {boolean} worker - Is the Agent a Web Worker
         * @property {string} brainType - The type of Brain to use
         * @property {cheatOpts} cheats - The cheats to display
         * @property {brainOpts} spec - The brain options
         * @property {envObject} env - The environment
         */

        /**
         * The env object is the representation of the environment
         * @typedef {Object} envObject
         * @property {number} numTypes - The number of types the Agent can sense
         * @property {number} numEyes - The number of the Agent's eyes
         * @property {number} range - The range of the eyes
         * @property {number} proximity - The proximity range of the eyes
         * @property {number} numActions - The number of actions the agent can perform
         * @property {number} numStates - The number of states
         * @property {number} getMaxNumActions - function that returns the numActions value
         * @property {number} getNumStates - function that returns the numStates value
         */

        /**
         * The options for the Agents brain
         * @typedef {Object} brainOpts
         * @property {string} update - qlearn | sarsa
         * @property {number} gamma - Discount factor [0, 1]
         * @property {number} epsilon - Initial epsilon for epsilon-greedy policy [0, 1]
         * @property {number} alpha - Value function learning rate
         * @property {number} experienceAddEvery - Number of time steps before we add another experience to replay memory
         * @property {number} experienceSize - Size of experience
         * @property {number} learningStepsPerIteration - Number of steps to go through during one tick
         * @property {number} tdErrorClamp - For robustness
         * @property {number} numHiddenUnits - Number of neurons in hidden layer
         */

        /**
         * Initialize the Agent
         * @name Agent
         * @extends Entity
         * @constructor
         *
         * @param {Vec} position - The x, y location
         * @param {agentOpts} opts - The Agent options
         * @returns {Agent}
         */
        constructor(position, opts) {
            // Is it a worker
            let worker = Utility.getOpt(opts, 'worker', false);
            super((worker ? 'Agent Worker' : 'Agent'), position, opts);

            this.worker = worker;
            // Just a text value for the brain type, also useful for worker posts
            this.brainType = Utility.getOpt(opts, 'brainType', 'RL.DQNAgent');
            // The number of actions the Agent can do
            this.numActions = Utility.getOpt(opts, 'numActions', 4);
            // The number of item types the Agent's eyes can see
            this.numTypes = Utility.getOpt(opts, 'numTypes', 3);
            // The number of Agent's eyes
            this.numEyes = Utility.getOpt(opts, 'numEyes', 9);
            // The number of Agent's proprioception values
            this.numProprioception = Utility.getOpt(opts, 'numProprioception', 0);
            // The range of the Agent's eyes
            this.range = Utility.getOpt(opts, 'range', 85);
            // The proximity of the Agent's eyes
            this.proximity = Utility.getOpt(opts, 'proximity', 85);
            // The number of Agent's eyes times the number of known types plus the number of
            // proprioception values it is tracking
            this.numStates = this.numEyes * this.numTypes + this.numProprioception;

            // The Agent's actions
            this.actions = [];
            for (let i = 0; i < this.numActions; i++) {
                this.actions.push(i);
            }

            // Set the brain options
            this.brainOpts = Utility.getOpt(opts, 'spec', {
                update: "qlearn", // qlearn | sarsa
                gamma: 0.9, // discount factor, [0, 1)
                epsilon: 0.2, // initial epsilon for epsilon-greedy policy, [0, 1)
                alpha: 0.005, // value function learning rate
                experienceAddEvery: 5, // number of time steps before we add another experience to replay memory
                experienceSize: 10000, // size of experience
                learningStepsPerIteration: 5,
                tdErrorClamp: 1.0, // for robustness
                numHiddenUnits: 100 // number of neurons in hidden layer
            });

            // The Agent's environment
            this.env = Utility.getOpt(opts, 'env', {
                getNumStates: () => {
                    return this.numStates;
                },
                getMaxNumActions: () => {
                    return this.numActions;
                },
                startState: () => {
                    return 0;
                }
            });

            // The Agent's eyes
            if (this.eyes === undefined) {
                this.eyes = [];
                for (let k = 0; k < this.numEyes; k++) {
                    let angle = k * 0.21;
                    let eye = {
                        angle: angle,
                        range: this.range,
                        sensed: {
                            type: -1,
                            proximity: this.proximity,
                            position: new Vec(0, 0),
                            velocity: new Vec(0, 0)
                        },
                        minPos: new Vec(this.position.x + this.radius * Math.sin(angle), this.position.y + this.radius * Math.cos(angle)),
                        maxPos: new Vec(this.position.x + this.range * Math.sin(angle), this.position.y + this.range * Math.cos(angle)),
                        shape: new PIXI.Graphics()
                    };
                    this.eyes.push(eye);
                }
            }

            // Reward or punishment
            this.carrot = 1;
            this.stick = -1;

            this.action = null;
            this.avgReward = 0;
            this.lastReward = 0;
            this.digestionSignal = 0.0;
            this.epsilon = 0.000;

            this.nStepsHistory = [];
            this.pts = [];
            this.brain = {};
            this.brainState = {};

            this.reset();

            return this;
        }

        /**
         * Agent's chance to act on the world
         * @returns {Agent}
         */
        act() {
            // in forward pass the agent simply behaves in the environment
            let ne = this.numEyes * this.numTypes,
                inputArray = new Array(this.numStates);
            for (let i = 0; i < this.numEyes; i++) {
                let eye = this.eyes[i];
                inputArray[i * this.numTypes] = 1.0;
                inputArray[i * this.numTypes + 1] = 1.0;
                inputArray[i * this.numTypes + 2] = 1.0;
                inputArray[i * this.numTypes + 3] = eye.sensed.velocity.x; // velocity information of the sensed target
                inputArray[i * this.numTypes + 4] = eye.sensed.velocity.y;
                if (eye.sensed.type !== -1) {
                    // sensedType is 0 for wall, 1 for food and 2 for poison.
                    // lets do a 1-of-k encoding into the input array
                    inputArray[i * this.numTypes + eye.sensed.type] = eye.sensed.proximity / eye.range; // normalize to [0,1]
                }
            }

            // proprioception and orientation
            inputArray[ne + 0] = this.position.vx;
            inputArray[ne + 1] = this.position.vy;

            if (!this.worker) {
                this.action = this.brain.act(inputArray);
            } else {
                this.post('act', inputArray);
            }

            return this;
        }

        /**
         * Draws it
         * @returns {Agent}
         */
        draw() {
            super.draw();

            // Loop through the eyes and check the walls and nearby entities
            if (this.eyes !== undefined) {
                for (let ae = 0, ne = this.eyes.length; ae < ne; ae++) {
                    let eyeStartX = this.position.x + this.radius * Math.sin(this.position.angle + this.eyes[ae].angle),
                        eyeStartY = this.position.y + this.radius * Math.cos(this.position.angle + this.eyes[ae].angle),
                        eyeEndX = this.position.x + this.eyes[ae].sensed.proximity * Math.sin(this.position.angle + this.eyes[ae].angle),
                        eyeEndY = this.position.y + this.eyes[ae].sensed.proximity * Math.cos(this.position.angle + this.eyes[ae].angle);
                    this.eyes[ae].minPos = new Vec(eyeStartX, eyeStartY);
                    this.eyes[ae].maxPos = new Vec(eyeEndX, eyeEndY);

                    this.eyes[ae].shape.clear();
                    this.eyes[ae].shape.moveTo(this.eyes[ae].minPos.x, this.eyes[ae].minPos.y);
                    switch (this.eyes[ae].sensed.type) {
                        case 1:
                            // It is noms
                            this.eyes[ae].shape.lineStyle(0.5, 0xFF0000, 1);
                            break;
                        case 2:
                            // It is gnar gnar
                            this.eyes[ae].shape.lineStyle(0.5, 0x00FF00, 1);
                            break;
                        case 3:
                        case 4:
                        case 5:
                            // Is it another Agent
                            this.eyes[ae].shape.lineStyle(0.5, 0x0000FF, 1);
                            break;
                        default:
                            // Is it wall or nothing?
                            this.eyes[ae].shape.lineStyle(0.5, 0x000000, 1);
                            break;
                    }

                    this.eyes[ae].shape.lineTo(this.eyes[ae].maxPos.x, this.eyes[ae].maxPos.y);
                    this.eyes[ae].shape.endFill();
                }
            }

            if (this.cheats) {
                this.updateCheats();
            }

            return this;
        }

        /**
         * Agent's chance to learn
         * @returns {Agent}
         */
        learn() {
            this.lastReward = this.digestionSignal;

            if (!this.worker) {
                this.brain.learn(this.digestionSignal);
                this.epsilon = this.brain.epsilon;
                this.digestionSignal = 0;
            } else {
                this.post('learn', this.digestionSignal);
            }

            return this;
        }

        /**
         * Load a pre-trained agent
         * @param {String} file
         */
        load(file) {
            let self = this;
            $.getJSON(file, (data) => {
                if (!self.worker) {
                    if (self.brain.valueNet !== undefined) {
                        self.brain.valueNet.fromJSON(data);
                    } else {
                        self.brain.fromJSON(data);
                    }
                    self.brain.epsilon = 0.05;
                    self.brain.alpha = 0;
                } else {
                    self.post('load', JSON.stringify(data));
                }
            });

            return self;
        }

        /**
         * Move around
         * @returns {Agent}
         */
        move() {
            this.oldPosition = this.position.clone();
            this.oldAngle = this.position.angle;

            for (let i = 0; i < this.collisions.length; i++) {
                let collisionObj = this.collisions[i];
                if (collisionObj.distance <= this.radius) {
                    switch (collisionObj.type) {
                        case 0:
                            // Wall
                            // this.position = this.oldPosition;
                            // this.force.x = 0;
                            // this.force.y = 0;
                            break;
                        case 1:
                            // Noms
                            this.digestionSignal += this.carrot;
                            collisionObj.entity.cleanUp = true;
                            break;
                        case 2:
                            // Gnars
                            this.digestionSignal += this.stick;
                            collisionObj.entity.cleanUp = true;
                            break;
                        case 3:
                        case 4:
                            // Other Agents
                            this.force.x = collisionObj.target.vx;
                            this.force.y = collisionObj.target.vy;
                            break;
                    }
                }
            }

            // Execute agent's desired action
            switch (this.action) {
                case 0: // Left
                    this.force.x += -this.speed * 0.95;
                    break;
                case 1: // Right
                    this.force.x += this.speed * 0.95;
                    break;
                case 2: // Up
                    this.force.y += -this.speed * 0.95;
                    break;
                case 3: // Down
                    this.force.y += this.speed * 0.95;
                    break;
            }

            // Forward the agent by force
            this.position.vx = this.force.x;
            this.position.vy = this.force.y;
            this.position.advance(this.speed);
            this.direction = Utility.getDirection(this.position.direction);

            return this;
        }

        /**
         * Reset or set up the Agent
         */
        reset() {
            var brain = this.brainType.split('.');
            // If it's a worker then we have to load it a bit different
            if (!this.worker) {
                this.brain = new global[brain[0]][brain[1]](this.env, this.brainOpts);

                return this;
            } else {
                this.post = (cmd, input) => {
                    this.brain.postMessage({target: this.brainType, cmd: cmd, input: input});
                };

                let jEnv = Utility.stringify(this.env),
                    jOpts = Utility.stringify(this.brainOpts);

                this.brain = new Worker('js/lib/external/rl.js');
                this.brain.onmessage = (e) => {
                    let data = e.data;
                    switch (data.cmd) {
                        case 'act':
                            if (data.msg === 'complete') {
                                this.action = data.input;
                                this.move();
                                this.learn();
                            }
                            break;
                        case 'init':
                            if (data.msg === 'complete') {
                                //
                            }
                            break;
                        case 'learn':
                            if (data.msg === 'complete') {
                                this.brainState = JSON.stringify(data.input);
                            }
                            break;
                        case 'load':
                            if (data.msg === 'complete') {
                                this.brainState = JSON.stringify(data.input);
                            }
                            break;
                        case 'save':
                            if (data.msg === 'complete') {
                                this.brainState = JSON.stringify(data.input);
                            }
                            break;
                        default:
                            console.log('Unknown command: ' + data.cmd + ' message:' + data.msg);
                            break;
                    }
                };

                this.post('init', {env: jEnv, opts: jOpts});
            }

            return this;
        }

        /**
         *
         */
        save() {
            if (!this.worker) {
                this.brainState = JSON.stringify(this.brain.toJSON());
            } else {
                this.post('save');
            }
        }

        /**
         * Tick the agent
         * @param {World} world
         */
        tick() {
            if (this.eyes !== undefined) {
                for (let ae = 0, ne = this.eyes.length; ae < ne; ae++) {
                    // Reset our eye data
                    this.eyes[ae].sensed = {
                        type: -1,
                        proximity: this.eyes[ae].range,
                        position: this.eyes[ae].maxPos,
                        velocity: new Vec(0, 0)
                    };

                    for (let i = 0; i < this.eyes[ae].collisions.length; i++) {
                        let collisionObj = this.eyes[ae].collisions[i];
                        if (collisionObj.distance <= this.eyes[ae].range &&
                            collisionObj.id !== this.id) {
                            this.eyes[ae].sensed.type = collisionObj.type;
                            this.eyes[ae].sensed.proximity = collisionObj.distance;
                            this.eyes[ae].sensed.position.x = collisionObj.vecI.x;
                            this.eyes[ae].sensed.position.y = collisionObj.vecI.y;
                            if ('vx' in collisionObj.vecI) {
                                this.eyes[ae].sensed.velocity.x = collisionObj.vecI.vx;
                                this.eyes[ae].sensed.velocity.y = collisionObj.vecI.vy;
                            } else {
                                this.eyes[ae].sensed.velocity = new Vec(0, 0);
                            }
                            break;
                        }
                    }
                }
            }

            // Let the agents behave in the world based on their input
            this.act();

            // If it's not a worker we need to run the rest of the steps
            if (!this.worker) {
                // Move eet!
                this.move();
                // This is where the agents learns based on the feedback of their
                // actions on the environment
                this.learn();
            }

            return this;
        }

    }
    global.Agent = Agent;

}(this));