var Agent = Agent || {},
    Eye = Eye || {},
    Entity = Entity || {},
    Utility = Utility || {};

(function (global) {
    "use strict";

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
    function Agent(position, opts) {
        // Is it a worker
        this.worker = Utility.getOpt(opts, 'worker', false);
        Entity.call(this, (this.worker) ? 'Agent Worker' : 'Agent', position, opts);
        // Just a text value for the brain type, also useful for worker posts
        this.brainType = Utility.getOpt(opts, 'brainType', 'TD');
        // The number of item types the Agent's eyes can see
        this.numTypes = Utility.getOpt(opts, 'numTypes', 3);
        // The number of Agent's eyes
        this.numEyes = Utility.getOpt(opts, 'numEyes',  9);
        // The range of the Agent's eyes
        this.range = Utility.getOpt(opts, 'range',  85);
        // The proximity of the Agent's eyes
        this.proximity = Utility.getOpt(opts, 'proximity',  85);
        // The number of Agent's eyes times the number of known types
        this.numStates = this.numEyes * this.numTypes;

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
        this.env = Utility.getOpt(opts, 'env',  {
            numTypes: this.numTypes,
            numEyes: this.numEyes,
            range: this.range,
            proximity: this.proximity,
            numActions: this.numActions,
            numStates: this.numStates,
            getMaxNumActions: function () {
                return this.numActions;
            },
            getNumStates: function () {
                return this.numStates;
            }
        });

        // The Agent's eyes
        if (this.eyes === undefined) {
            this.eyes = [];
            for (let k = 0; k < this.numEyes; k++) {
                this.eyes.push(new Eye(k * 0.21, this.pos, this.range, this.proximity));
            }
        }

        this.action = null;
        this.avgReward = 0;
        this.lastReward = 0;
        this.digestionSignal = 0.0;
        this.rewardBonus = 0.0;
        this.previousActionIdx = -1;
        this.epsilon = 0.000;

        this.pts = [];
        this.direction = 'N';
        this.brain = {};
        this.brainState = {};
        this.world = {};

        return this;
    }

    Agent.prototype = Object.create(Entity.prototype);
    Agent.prototype.constructor = Entity;

    /**
     * Agent's chance to learn
     * @returns {Agent}
     */
    Agent.prototype.learn = function () {
        this.lastReward = this.digestionSignal;
        this.pts.push(this.digestionSignal);

        if (!this.worker) {
            this.brain.learn(this.digestionSignal);
            this.epsilon = this.brain.epsilon;
        } else {
            this.post('learn', this.digestionSignal);
        }

        return this;
    };

    /**
     * Load a pre-trained agent
     * @param {String} file
     */
    Agent.prototype.load = function (file) {
        let _this = this;
        $.getJSON(file, function(data) {
            if (!_this.worker) {
                _this.brain.fromJSON(data);
                _this.brain.epsilon = 0.05;
                _this.brain.alpha = 0;
            } else {
                _this.post('load', JSON.stringify(data));
            }
        });

        return this;
    };

    /**
     *
     */
    Agent.prototype.save = function () {
        if (!this.worker) {
            this.brainState = JSON.stringify(this.brain.toJSON());
        } else {
            this.post('save');
        }
    };

    /**
     * Tick the agent
     * @param {Object} world
     */
    Agent.prototype.tick = function (world) {
        this.world = world;
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
    };

    /**
     * Eye sensor has a maximum range and senses entities and walls
     * @param angle
     * @param range
     * @param proximity
     * @returns {Eye}
     * @name Eye
     * @constructor
     */
    function Eye(angle, position, range, proximity) {
        this.angle = angle;
        this.maxRange = range || 85;
        this.sensedProximity = proximity || 85;
        this.pos = position || new Vec(0, 0);
        this.maxPos = new Vec(0, 0);
        this.sensedType = -1;
        this.collisions = [];

        // PIXI graphics
        this.shape = new PIXI.Graphics();

        return this;
    }

    /**
     * Draw the lines for the eyes
     * @param agent
     */
    Eye.prototype.draw = function (agent) {
        this.pos = agent.pos.clone();
        this.shape.clear();

        switch (this.sensedType) {
            case -1:
            case 0:
                // Is it wall or nothing?
                this.shape.lineStyle(0.5, 0x000000);
                break;
            case 1:
                // It is noms
                this.shape.lineStyle(0.5, 0xFF0000);
                break;
            case 2:
                // It is gnar gnar
                this.shape.lineStyle(0.5, 0x00FF00);
                break;
            case 3:
            case 4:
            case 5:
                // Is it another Agent
                this.shape.lineStyle(0.5, 0xFAFAFA);
                break;
            default:
                this.shape.lineStyle(0.5, 0x000000);
                break;
        }

        let aEyeX = this.pos.x + this.sensedProximity * Math.sin(agent.angle + this.angle),
            aEyeY = this.pos.y + this.sensedProximity * Math.cos(agent.angle + this.angle);
        this.maxPos.set(aEyeX, aEyeY);

        // Draw the agent's line of sights
        this.shape.moveTo(this.pos.x, this.pos.y);
        this.shape.lineTo(aEyeX, aEyeY);
    };

    /**
     * Sense the surroundings
     * @param agent
     */
    Eye.prototype.sense = function (agent) {
        this.pos = agent.pos.clone();
        let result,
            aEyeX = this.pos.x + this.maxRange * Math.sin(agent.angle + this.angle),
            aEyeY = this.pos.y + this.maxRange * Math.cos(agent.angle + this.angle);
        this.maxPos.set(aEyeX, aEyeY);

        result = agent.world.sightCheck(this.pos, this.maxPos, agent.world.walls, agent.world.agents.concat(agent.world.entities), agent.radius);
        if (result) {
            // eye collided with an entity
            this.sensedProximity = result.vecI.distFrom(this.pos);
            this.sensedType = result.target.type;
            if ('vx' in result.vecI) {
                this.x = result.vecI.x;
                this.y = result.vecI.y;
                this.vx = result.vecI.vx;
                this.vy = result.vecI.vy;
            } else {
                this.x = 0;
                this.y = 0;
                this.vx = 0;
                this.vy = 0;
            }
        } else {
            this.sensedProximity = this.maxRange;
            this.sensedType = -1;
            this.x = 0;
            this.y = 0;
            this.vx = 0;
            this.vy = 0;
        }
    };

    global.Eye = Eye;
    global.Agent = Agent;

}(this));

