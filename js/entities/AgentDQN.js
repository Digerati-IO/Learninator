var AgentDQN = AgentDQN || {};
var Eye = Eye || {};
var Utility = Utility || {};
var PIXI = PIXI || {};

(function (global) {
	"use strict";

	/**
	 * A single agent
	 * @returns {Agent_L3.Agent}
	 */
	class AgentDQN {
		constructor (interactive, display) {
			this.id = Utility.guid();
			this.type = 3;
			this.name = 'DQN Agent Normal';
			(display) ? this.camera = new Camera(display, 320, 0.8) : undefined;
			this.position = new Vec(5, 5);
			this.velocity = new Vec(0, 0);
			this.gridLocation = new Cell(0, 0);
			this.width = 20;
			this.height = 20;
			this.radius = 10;
			this.angle = 0;
			this.rot1 = 0.0;
			this.rot2 = 0.0;
			this.lastReward = 0;
			this.rewardBonus = 0.0;
			this.digestionSignal = 0.0;
			this.pts = [];
			this.digested = [];
			this.previousActionIdx = -1;
			this.direction = '';
			this.interactive = interactive || false;

			// Remember the Agent's old position
			this.oldPos = this.position;

			// Remember the Agent's old angle
			this.oldAngle = this.angle;

			// The number of item types the Agent's eys can see (wall, green, red thing proximity)
			this.numTypes = 3;

			// The number of Agent's eyes
			this.numEyes = 30;

			// The number of Agent's eyes, each one sees the number of knownTypes + the two velocity inputs
			this.numStates = this.numEyes * 5 + 2;

			// The Agent's eyes
			this.eyes = [];
			for (var k = 0; k < this.numEyes; k++) {
				this.eyes.push(new Eye(k * 0.21));
			}

			// The Agent's actions
			this.actions = [];
			this.actions.push(0);
			this.actions.push(1);
			this.actions.push(2);
			this.actions.push(3);

			// The number of possible angles the Agent can turn
			this.numActions = this.actions.length;

			var _this = this;
	
			var env = {};
            env.getNumStates = function() {
                return _this.numStates;
            };
            env.getMaxNumActions = function() {
                return _this.numActions;
            };

            var brainOptsDQN = {};
            brainOptsDQN.update = 'qlearn'; // qlearn | sarsa
            brainOptsDQN.gamma = 0.9; // discount factor, [0, 1)
            brainOptsDQN.epsilon = 0.2; // initial epsilon for epsilon-greedy policy, [0, 1)
            brainOptsDQN.alpha = 0.005; // value function learning rate
            brainOptsDQN.experience_add_every = 5; // number of time steps before we add another experience to replay memory
            brainOptsDQN.experience_size = 10000; // size of experience
            brainOptsDQN.learning_steps_per_iteration = 5;
            brainOptsDQN.tderror_clamp = 1.0; // for robustness
            brainOptsDQN.num_hidden_units = 100 // number of neurons in hidden layer

			this.brainOpts = brainOptsDQN;
			this.brain = new RL.DQNAgent(env, this.brainOpts);

			this.texture = PIXI.Texture.fromImage("img/Agent.png");
			this.sprite = new PIXI.Sprite(this.texture);
			this.sprite.width = this.width;
			this.sprite.height = this.height;
			this.sprite.anchor.set(0.5, 0.5);
			this.sprite.position.set(this.position.x, this.position.y);

			if (this.interactive == true) {
				this.sprite.interactive = true;
				this.sprite
					.on('mousedown', this.onDragStart)
					.on('touchstart', this.onDragStart)
					.on('mouseup', this.onDragEnd)
					.on('mouseupoutside', this.onDragEnd)
					.on('touchend', this.onDragEnd)
					.on('touchendoutside', this.onDragEnd)
					.on('mouseover', this.onMouseOver)
					.on('mouseout', this.onMouseOut)
					.on('mousemove', this.onDragMove)
					.on('touchmove', this.onDragMove);
				this.sprite.entity = _this;
			}

		};

        act (walls, entities, width, height) {
            // in forward pass the agent simply behaves in the environment
            var ne = this.numEyes * 5;
            var inputArray = new Array(this.numStates);
            for(var i=0; i<this.numEyes; i++) {
                var e = this.eyes[i];
                inputArray[i*5] = 1.0;
                inputArray[i*5+1] = 1.0;
                inputArray[i*5+2] = 1.0;
                inputArray[i*5+3] = e.vx; // velocity information of the sensed target
                inputArray[i*5+4] = e.vy;
                if(e.sensed_type !== -1) {
                    // sensedType is 0 for wall, 1 for food and 2 for poison.
                    // lets do a 1-of-k encoding into the input array
                    inputArray[i*5 + e.sensedType] = e.sensedProximity/e.maxRange; // normalize to [0,1]
                }
            }

            // proprioception and orientation
            inputArray[ne+0] = this.velocity.x;
            inputArray[ne+1] = this.velocity.y;

            this.action = this.brain.act(inputArray);
            
			// execute agent's desired action
			var speed = 1;
			if(this.action === 0) {
				this.velocity.x += -speed;
			}
			if(this.action === 1) {
				this.velocity.x += speed;
			}
			if(this.action === 2) {
				this.velocity.y += -speed;
			}
			if(this.action === 3) {
				this.velocity.y += speed;
			}

			// forward the agent by velocity
			this.velocity.x *= 0.95; 
			this.velocity.y *= 0.95;
			this.position.x += this.velocity.x; 
			this.position.y += this.velocity.y;

			// The agent is trying to move from pos to oPos so we need to check walls
			var result = Utility.collisionCheck(this.oldPos, this.position, walls);
			if (result) {
				// The agent derped! Wall collision! Reset their position
				this.position = this.oldPos;
			}

			// Check for food
			// Gather up all the entities nearby based on cell population
			this.digested = [];
			for (var j=0, n=this.gridLocation.population.length; j<n; j++) {
				var entity = entities.find(Utility.getId, this.gridLocation.population[j]);
				if (entity) {
					var dist = this.position.distanceTo(entity.position);
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

			if (this.digested.length > 0) {
				this.pts.push(this.lastReward);
			}
        };

        learn () {
            var reward = this.digestionSignal;
            this.lastReward = reward; // for vis
            this.brain.learn(reward);
        };

		/**
		 * Tick the agent
		 * @param {Object} smallWorld
		 * @returns {undefined}
		 */
		tick (smallWorld) {
			this.oldPos = new Vec(this.position.x, this.position.y);
			this.oldAngle = this.angle;

			// Loop through the eyes and check the walls and nearby entities
			for (var ei=0; ei<this.numEyes; ei++) {
				this.eyes[ei].sense(this, smallWorld.walls, smallWorld.entities);
			}

			// Let the agents behave in the world based on their input
			this.act(smallWorld.walls, smallWorld.entities, smallWorld.width, smallWorld.height);

			// Loop through the eyes and draw them
			for (var ei=0; ei<this.numEyes; ei++) {
				this.eyes[ei].draw(this);
			}

			// Handle boundary conditions.. bounce agent
			Utility.boundaryCheck(this, smallWorld.width, smallWorld.height);
			
			// This is where the agents learns based on the feedback of their actions on the environment
			this.learn();
		};
	};

	global.AgentDQN = AgentDQN;

}(this));

