var Life = Life || {};

/**
 * Represents a simulation, consisting of a toroidal grid of cells,
 * each of which may contain food, and a set of Agents.
 * @param parameters A list of parameters, see
 * <a href="https://github.com/JimAllanson/lifejs/wiki/Default-Parameters">
 *   a list of defaults here.</a>
 * @constructor
 */
Life.World = function(parameters) {
  this.parameters = parameters;
  this.agents = [];
  this.food = [];
  this.tick = 0;

  var idCounter = 0,
      closed = false,
      numHerbivore = [],
      numCarnivore = [],
      foodWidth = Math.floor(this.parameters.width / this.parameters.cellSize),
      foodHeight = Math.floor(this.parameters.height / this.parameters.cellSize);

  for (let x = 0; x < foodWidth; x++) {
    this.food[x] = [];
    for (let y = 0; y < foodHeight; y++) {
      this.food[x][y] = 0;
    }
  }

  /**
   * Runs through one tick of the simulation, supplying each agent with inputs, ticking their brains and processing
   * outputs. Also handles events such as eating, birth and death.
   */
  this.update = function() {
    this.tick++;

    //Every so often, new food grows in a random cell.
    if (this.tick % this.parameters.foodAddFrequency == 0) {
      var fx = Math.floor(Math.random() * foodWidth);
      var fy = Math.floor(Math.random() * foodHeight);
      this.food[fx][fy] = this.parameters.maxFood;
    }

    for (var id in this.agents) {
      this.agents[id].spiked = false;
    }

    this.setInputs();
    this.brainsTick();
    this.processOutputs();

    for (var id in this.agents) {
      var agent = this.agents[id];

      if (this.tick % 100 === 0) {
        agent.age++;
      }

      // Remove some health each tick as a base survival cost
      var baseLoss = 0.0002;
      if (agent.sprinting) {
        agent.health -= baseLoss * this.parameters.agent.sprintMultiplier * 1.3;
      } else {
        agent.health -= baseLoss;
      }

      // Subtract health for agents in an uncomfortable temperature
      var discomfort = Math.pow(Math.abs(2 * Math.abs(agent.pos.x / this.parameters.width - 0.5) - agent.temperaturePreference), 2);
      if (discomfort < 0.08) {
        discomfort = 0;
      }
      agent.health -= this.parameters.agent.temperatureDiscomfortDamage * discomfort;

      // Indicators shrink each tick
      if (agent.indicator.size > 0) {
        agent.indicator.size--;
      }

      // Process agents attacked by carnivores
      if (agent.health <= 0 && agent.spiked) {
        // Babies are less nutritious... (stops parents immediately eating their children).
        var ageMultiplier = agent.age < 5 ? agent.age * 0.2 : 1;

        // Give some health back to any nearby agents
        var agentsAround = [];
        for (var id2 in this.agents) {
          var agent2 = this.agents[id2];
          if (agent.pos.distanceFrom(agent2.pos) < this.parameters.agent.bodyDecayRadius) {
            agentsAround.push(agent2);
          }
        }

        for (var id2 in agentsAround) {
          var agent2 = agentsAround[id2];
          if (agent2.health > 0) {
            agent2.health += 5 * (1 - agent2.herbivore) * (1 - agent2.herbivore) / Math.pow(agentsAround.length, 1.25) * ageMultiplier;
            agent2.repCounter -= this.parameters.agent.bodyFertilityBonus * (1 - agent.herbivore) * (1 - agent.herbivore) / Math.pow(agentsAround.length, 1.25) * ageMultiplier;
            if (agent2.health > 2) {
              agent2.health = 2;
            }
            agent2.indicator = {
              size: 30,
              red: 0.8,
              green: 1,
              blue: 0.8
            };
          }
        }
      }

      //Remove any dead agents from the world
      if (agent.health <= 0) {
        this.agents.splice(id, 1);
        if (agent.selectFlag) {
          this.agents[0].selectFlag = true;
        }
      }

      //Occasionally allow agents to asexually reproduce
      /*
       if (agent.repCounter < 0 && agent.health > 0.65 && tick % 15 == 0 && Math.random() < 0.1) {
       this.asexuallyReproduce(agent, agent.mutationRate[0], agent.mutationRate[1]);
       agent.repCounter = agent.herbivore * ((Math.random() * 0.2) + parameters.agent.reproductionRate.herbivore - 0.1)
       + (1 - agent.herbivore) * ((Math.random() * 0.2) + parameters.agent.reproductionRate.carnivore - 0.1);
       }
       */

      //Periodically breed / create new bots
      if (!closed) {
        if (this.agents.length < this.parameters.minAgents) {
          this.addRandomBots(1);
        }
        if (this.tick % 100 == 0 && this.agents.length < this.parameters.maxAgents) {
          //if (Math.random() < 0.5) {
          //    this.addRandomBots(1);
          //} else {
          //Only sexual reproduction is enabled at the moment
          this.sexuallyReproduce();
          //}
        }
      }
    }
  };

  /**
   * Calculates values for agent sensors and sets them as input to the brain.
   */
  this.setInputs = function() {
    for (var id in this.agents) {
      var agent = this.agents[id];

      for (var i in agent.eyes) {
        agent.eyes[i].reset();
      }

      //Initialise sensor
      var soundSensor = 0;
      var smellSensor = 0;
      var hearingSensor = 0;
      var bloodSensor = 0;

      for (var id2 in this.agents) {
        //For each other agent in the simulation...
        if (id === id2) {
          continue;
        }
        var agent2 = this.agents[id2];

        //If the agent is within view distance
        var viewDistance = this.parameters.agent.viewDistance;
        var distance = agent.pos.distanceFrom(agent2.pos);
        if (distance < viewDistance) {
          //Modify smell sound and hearing sensors
          smellSensor += (viewDistance - distance) / viewDistance;
          soundSensor += (viewDistance - distance) / viewDistance * (Math.max(Math.abs(agent2.wheel1), Math.abs(agent2.wheel2)));
          hearingSensor += agent2.soundMultiplier * (viewDistance - distance) / viewDistance;

          var a2x = agent2.pos.x;

          //For each eye
          for (var i in agent.eyes) {
            agent.eyes[i].look(agent, agent2);
          }

          var angle = agent.pos.angleFromNorth(agent2.pos);
          //Blood sensor
          var diff = agent.angle - angle;
          if (Math.abs(agent.angle) > Math.PI) {
            diff = 2 * Math.PI - Math.abs(agent.angle);
          }
          diff = Math.abs(diff);
          var PI38 = (Math.PI / 8 / 2) * 3;
          if (diff < PI38) {
            var mul = ((PI38 - diff) / PI38) * ((viewDistance - distance) / viewDistance);
            bloodSensor += mul * (1 - agent2.health / 2);
          }
        }
      }

      smellSensor *= agent.smellModifier;
      soundSensor *= agent.soundModifier;
      hearingSensor *= agent.hearingModifier;
      bloodSensor *= agent.bloodModifier;

      //Calculate agent's temperature discomfort
      var discomfort = Math.abs((2 * Math.abs(agent.pos.x / this.parameters.width - 0.5)) - agent.temperaturePreference);

      //Get food level at the agent's current location
      var cx = Math.floor(agent.pos.x / this.parameters.cellSize);
      var cy = Math.floor(agent.pos.y / this.parameters.cellSize);
      var food = this.food[cx][cy] / this.parameters.maxFood;

      //Set inputs to agent's brain to sensor values
      agent.in = [
        Life.Utils.cap(agent.eyes[0].proximity),
        Life.Utils.cap(agent.eyes[0].red),
        Life.Utils.cap(agent.eyes[0].green),
        Life.Utils.cap(agent.eyes[0].blue),

        food,

        Life.Utils.cap(agent.eyes[1].proximity),
        Life.Utils.cap(agent.eyes[1].red),
        Life.Utils.cap(agent.eyes[1].green),
        Life.Utils.cap(agent.eyes[1].blue),

        Life.Utils.cap(soundSensor),
        Life.Utils.cap(smellSensor),
        Life.Utils.cap(agent.health / 2),

        Life.Utils.cap(agent.eyes[2].proximity),
        Life.Utils.cap(agent.eyes[2].red),
        Life.Utils.cap(agent.eyes[2].green),
        Life.Utils.cap(agent.eyes[2].blue),

        Math.abs(Math.sin(this.tick / agent.clock1)),
        Math.abs(Math.sin(this.tick / agent.clock2)),
        Life.Utils.cap(hearingSensor),
        Life.Utils.cap(bloodSensor),

        discomfort,

        Life.Utils.cap(agent.eyes[3].proximity),
        Life.Utils.cap(agent.eyes[3].red),
        Life.Utils.cap(agent.eyes[3].green),
        Life.Utils.cap(agent.eyes[3].blue)
      ];
    }
  };

  /**
   * Takes outputs from agent brain and translates them to agent properties
   */
  this.processOutputs = function() {
    for (var id in this.agents) {
      var agent = this.agents[id];

      // Set agent's colour
      agent.red = agent.out[2];
      agent.green = agent.out[3];
      agent.blue = agent.out[4];

      // Set agent's wheel velocities
      agent.wheel1 = agent.out[0];
      agent.wheel2 = agent.out[1];

      // Whether agent is sprinting
      agent.sprinting = agent.out[6] > 0.5;
      // Noisyness of agent
      agent.soundMultiplier = agent.out[7];
      // Whether agent wants to gift some of its food to others nearby
      agent.give = agent.out[8];

      // Extend or retract spike
      if (agent.spikeLength < agent.out[5]) {
        agent.spikeLength += this.parameters.agent.spikeSpeed;
      } else if (agent.spikeLength > agent.out[5]) {
        agent.spikeLength = agent.out[5];
      }

      //Move bots
      var v = new Life.Vector(0, this.parameters.agent.radius / 2);
      v = v.rotate(agent.angle);
      var wheel1Position = agent.pos.add(v);
      var wheel2Position = agent.pos.subtract(v);

      var speed = agent.sprinting ? this.parameters.agent.speed * this.parameters.agent.sprintMultiplier : this.parameters.agent.speed;
      var wheel1Velocity = speed * agent.wheel1;
      var wheel2Velocity = speed * agent.wheel2;

      //New position
      var vv = wheel2Position.subtract(agent.pos);
      vv = vv.rotate(-wheel1Velocity);
      agent.pos = wheel2Position.subtract(vv);
      vv = agent.pos.subtract(wheel1Position);
      vv = vv.rotate(wheel2Velocity);
      agent.pos = wheel1Position.add(vv);

      //New angle
      agent.angle -= wheel1Velocity;
      if (agent.angle < 0) {
        agent.angle += 2 * Math.PI;
      }
      agent.angle += wheel2Velocity;
      if (agent.angle > 2 * Math.PI) {
        agent.angle -= 2 * Math.PI;
      }

      //Handle agents going over edges of the toroid
      if (agent.pos.x < 0) {
        agent.pos.x = this.parameters.width + agent.pos.x;
      }
      if (agent.pos.x >= this.parameters.width) {
        agent.pos.x = agent.pos.x - this.parameters.width;
      }
      if (agent.pos.y < 0) {
        agent.pos.y = this.parameters.height + agent.pos.y;
      }
      if (agent.pos.y >= this.parameters.height) {
        agent.pos.y = agent.pos.y - this.parameters.height;
      }

      //Eat as much food as agent can in one tick from current cell
      var cx = Math.floor(agent.pos.x / this.parameters.cellSize);
      var cy = Math.floor(agent.pos.y / this.parameters.cellSize);
      var foodHere = this.food[cx][cy];
      if (foodHere > 0 && agent.health < 2) {
        var intake = Math.min(foodHere, this.parameters.agent.foodIntake);
        var speedMultiplier = (1 - Math.abs(agent.wheel1) + Math.abs(agent.wheel2) / 2) * 0.7 + 0.3;
        intake *= agent.herbivore * speedMultiplier;
        agent.health += intake;
        agent.bodyFertilityBonus -= 3 * intake;
        this.food[cx][cy] -= Math.min(foodHere, this.parameters.agent.foodWasted);
      }

      //If the agent wants to give food, give some to any other agents in range
      if (agent.give > 0.5) {
        for (var id2 in this.agents) {
          var agent2 = this.agents[id2];
          var distance = Math.sqrt(Math.pow(Math.abs(agent.pos.x - agent2.pos.x), 2) + Math.pow(agent.pos.y - agent2.pos.y, 2));
          if (distance < this.parameters.agent.foodTradeDistance) {
            if (agent2.health < 2) {
              agent2.health += this.parameters.agent.foodTraded;
              agent2.indicator = {
                size: 7,
                red: 0,
                green: 1,
                blue: 0
              };
            }
            agent.health -= this.parameters.agent.foodTraded;
            agent.indicator = {
              size: 7,
              red: 0.6,
              green: 0.4,
              blue: 0.2
            };
          }
        }
      }

      if (this.tick % 2 == 0) {
        //If the agent is a herbivore, has its spike retracted or is moving very slowly, it can't attack
        if (agent.herbivore > 0.8 || agent.spikeLength < 0.2 || agent.wheel1 < 0.5 || agent.wheel2 < 0.5) {
          continue;
        }

        //Otherwise, get all nearby agents
        for (var id2 in this.agents) {
          var agent2 = this.agents[id2];
          if (agent === agent2) {
            continue;
          }

          //Agent is within stabbing range
          if (agent.pos.distanceFrom(agent2.pos) < this.parameters.agent.radius * 2) {
            var diff = Math.min((2 * Math.PI) - Math.abs(agent.angle - agent.pos.angleFromNorth(agent2.pos)), Math.abs(agent.angle - agent.pos.angleFromNorth(agent2.pos)));
            if (diff < Math.PI / 8) {
              var speedMultiplier = agent.sprinting ? this.parameters.agent.sprintMultiplier : 1;
              var damage = this.parameters.agent.spikeStrength * agent.spikeLength * Math.max(Math.abs(agent.wheel1), Math.abs(agent.wheel2)) * speedMultiplier;
              agent2.health -= damage;

              agent.spikeLength = 0;
              agent.indicator = {
                size: 40 * damage,
                red: 1,
                green: 1,
                blue: 0
              };

              var behind = agent2.angle + Math.PI > 2 * Math.PI ? (agent2.angle + Math.PI) - 2 * Math.PI : agent2.angle + Math.PI;
              if (Math.abs(behind - agent2.pos.angleFromNorth(agent.pos)) < Math.PI / 2) {
                agent2.spikeLength = 0;
              }
              agent2.spiked = true;
            }
          }
        }
      }
    }
  };

  /**
   * Tick each agent's brain
   */
  this.brainsTick = function() {
    for (var id in this.agents) {
      var agent = this.agents[id];
      agent.tick();
    }
  };

  this.addCarnivore = function() {
    var agent = new Life.Agent(this.parameters);
    agent.id = idCounter;
    idCounter++;
    agent.herbivore = Math.random() / 10;
    this.agents.push(agent);
  };

  this.addHerbivore = function() {
    var agent = new Life.Agent(this.parameters);
    agent.id = idCounter;
    idCounter++;
    agent.herbivore = Math.random() / 10 + 0.9;
    this.agents.push(agent);
  };

  /**
   * Takes the two oldest agents and crosses them, producing a number of new agents (as defined by agent's babies
   * parameter)
   */
  this.sexuallyReproduce = function() {
    var i1 = Math.floor(Math.random() * this.agents.length);
    var i2 = Math.floor(Math.random() * this.agents.length);
    for (var i = 0; i < this.agents.length; i++) {
      if (this.agents[i].age > this.agents[i1].age && Math.random() < 0.1) {
        i1 = i;
      }
      if (this.agents[i].age > this.agents[i2].age && Math.random() < 0.1 && i != i1) {
        i2 = i;
      }
    }
    for (var i = 0; i < this.parameters.agent.babies; i++) {
      var newAgent = this.agents[i1].crossover(this.agents[i2]);
      newAgent.id = idCounter;
      idCounter++;
      this.agents.push(newAgent);
    }
  };

  /**
   * Produces a a clone of this agent, with some random mutations.
   * @param agent Agent to clone.
   */
  this.asexuallyReproduce = function(agent) {
    agent.indicator = {
      size: 30,
      red: 0,
      green: 0.8,
      blue: 0
    };

    for (var i = 0; i < this.parameters.agent.babies; i++) {
      var agent2 = agent.asexuallyReproduce();
      agent2.id = idCounter;
      idCounter++;
      this.agents.push(agent2);
    }
  };

  /**
   * Produces a number of random agents
   * @param quantity number of agents to produce
   */
  this.addRandomBots = function(quantity) {
    for (var i = 0; i < quantity; i++) {
      var agent = new Life.Agent(this.parameters);
      agent.id = idCounter;
      idCounter++;
      this.agents.push(agent);
    }
  };

  /**
   * Return an array containing the number of herbivores and carnivores in the current simulation
   * @return {Array} Number of herbivores [0] and carnivores [1]
   */
  this.numHerbivoresCarnivores = function() {
    var h = 0, c = 0;
    for (var id in this.agents) {
      var agent = this.agents[id];
      if (agent.herbivore > 0.5) {
        h++;
      } else {
        c++;
      }
      return [h, c];
    }
  };

  /**
   * Handles a change of parameters, rebuilding affected parts of agent if they've changed
   * @param parameters New parameters.
   */
  this.setParameters = function(parameters) {
    if (this.parameters.width !== parameters.width || this.parameters.height !== parameters.height || this.parameters.cellSize !== parameters.cellSize) {
      foodWidth = Math.floor(this.parameters.width / this.parameters.cellSize);
      foodHeight = Math.floor(this.parameters.height / this.parameters.cellSize);

      for (var x = 0; x < foodWidth; x++) {
        this.food[x] = [];
        for (var y = 0; y < foodHeight; y++) {
          this.food[x][y] = 0;
        }
      }
    }

    if (this.parameters.tickDuration !== parameters.tickDuration) {
      clearInterval(_timer);
      _timer = setInterval(tick, parameters.tickDuration);
    }

    for (var id in this.agents) {
      this.agents[id].setParameters(parameters);
    }

    this.parameters = parameters;
  };

  this.addRandomBots(this.parameters.maxAgents);
};

/**
 * An agent operating within the simulation, consisting of a number
 * of sensors, effectors, a brain and the ability to reproduce
 * @param parameters  A list of parameters, see
 * <a href="https://github.com/JimAllanson/lifejs/wiki/Default-Parameters">
 *   a list of defaults here.</a>
 * @constructor
 */
Life.Agent = function(parameters) {
  //Initial position and angle
  var _x = Math.floor(Math.random() * parameters.width),
      _y = Math.floor(Math.random() * parameters.height),
      _parameters = parameters;

  this.selectFlag = false;

  this.id = 0;
  this.age = 0;
  this.pos = new Life.Vector(_x, _y);
  this.angle = Math.random() * 2 * Math.PI;

  this.spikeLength = 0;
  this.spiked = false;

  //Colour
  this.red = 0;
  this.green = 0;
  this.blue = 0;

  this.wheel1 = 0;
  this.wheel2 = 0;

  this.soundMultiplier = 1;

  this.mutationRate = [
    Math.random() * 0.004 + 0.001,
    Math.random() * 0.04 + 0.03
  ];
  this.generationCount = 0;
  this.hybrid = false;

  this.clock1 = Math.random() * 95 + 5;
  this.clock2 = Math.random() * 95 + 5;

  this.sprinting = false;
  this.give = 0;
  this.herbivore = Math.random();
  this.health = Math.random() * 0.1 + 1;

  this.temperaturePreference = Math.random();

  this.in = [];
  this.out = [];
  for (var i = 0; i < _parameters.brain.outputSize; i++) {
    this.out[i] = 0;
  }

  this.repCounter = this.herbivore * ((Math.random() * 0.2) + _parameters.agent.reproductionRate.herbivore - 0.1)
      + (1 - this.herbivore) * ((Math.random() * 0.2) + _parameters.agent.reproductionRate.herbivore - 0.1);

  this.smellModifier = Math.random() * 0.4 + 0.1;
  this.soundModifier = Math.random() * 0.4 + 0.2;
  this.hearingModifier = Math.random() * 0.6 + 0.7;
  this.eyeSenseModifier = Math.random() * 2 + 1;
  //this.eyeSenseModifier = Math.random();
  this.bloodModifier = Math.random() * 2 + 1;

  this.eyes = [];
  for (var i = 0; i < _parameters.agent.numberEyes; i++) {
    var eye = new Life.Agent.Eye(this);
    eye.fov = Math.random() * 1.5 + 0.5;
    eye.direction = i * (Math.PI / 2);
    this.eyes.push(eye);
  }

  this.viewDistance = _parameters.agent.viewDistance;

  //Event indication
  this.indicator = {
    size: 0,
    red: 0,
    green: 0,
    blue: 0
  };

  this.brain = new Life.Brain(_parameters, this.in, this.out);

  /**
   * Performs a single tick of the agents brain, processing the current inputs into a set of outputs.
   */
  this.tick = function() {
    this.brain.tick(this.in, this.out);
  };

  /**
   * Produces a clone of this agent, with random mutations.
   * @return {Life.Agent} A mutated clone of the current agent
   */
  this.asexuallyReproduce = function() {
    //Create a new agent
    var agent = new Life.Agent(_parameters);

    //Place it behind its parent
    var x = Life.Utils.randomNormal(this.pos.x, 100);
    var y = Life.Utils.randomNormal(this.pos.y, 100);
    agent.pos = new Life.Vector(x, y);

    //Handle agents going over edges of the toroid
    if (agent.pos.x < 0) {
      agent.pos.x = _parameters.width + agent.pos.x;
    }
    if (agent.pos.x >= _parameters.width) {
      agent.pos.x = agent.pos.x - _parameters.width;
    }
    if (agent.pos.y < 0) {
      agent.pos.y = _parameters.height + agent.pos.y;
    }
    if (agent.pos.y >= _parameters.height) {
      agent.pos.y = agent.pos.y - _parameters.height;
    }

    //Assign generation number and nutrient value for body
    agent.generationCount = this.generationCount + 1;
    agent.repCounter = agent.herbivore * ((Math.random() * 0.2) + _parameters.agent.reproductionRate.herbivore - 0.1)
        + (1 - agent.herbivore) * ((Math.random() * 0.2) + _parameters.agent.reproductionRate.carnivore - 0.1);

    //Copy mutation rate from parent, randomised using normal distribution with sigma value from _parameters
    agent.mutationRate = this.mutationRate;

    //Randomise food preference and body clocks from parent's values and mutation rate
    agent.herbivore = this.herbivore;
    agent.clock1 = this.clock1;
    agent.clock2 = this.clock2;

    //Copy senses from parent
    agent.smellModifier = this.smellModifier;
    agent.soundModifier = this.soundModifier;
    agent.hearingModifier = this.hearingModifier;
    agent.eyeSenseModifier = this.eyeSenseModifier;
    agent.bloodModifier = this.bloodModifier;

    //Copy eyes
    agent.eyes = this.eyes;

    agent.temperaturePreference = this.temperaturePreference;
    agent.brain = this.brain;
    agent.mutate();

    return agent;
  };

  /**
   * Performs mutations on the current agent and its brain.
   */
  this.mutate = function() {
    //Mutate mutation rate
    if (Math.random() < 0.1) {
      this.mutationRate[0] = Life.Utils.randomNormal(this.mutationRate[0], _parameters.agent.mutationRate[0]);
    }
    if (Math.random() < 0.1) {
      this.mutationRate[1] = Life.Utils.randomNormal(this.mutationRate[1], _parameters.agent.mutationRate[1]);
    }
    if (this.mutationRate[0] < 0.001) {
      this.mutationRate[0] = 0.001;
    }
    if (this.mutationRate[1] < 0.02) {
      this.mutationRate[1] = 0.02;
    }

    //Low probability of increased mutation rates
    //var mutationRate1 = Math.random() < 0.04 ? this.mutationRate[0] *= Math.random() * 10 : this.mutationRate[0];
    //var mutationRate2 = Math.random() < 0.04 ? this.mutationRate[1] *= Math.random() * 10 : this.mutationRate[1];

    //Mutate Herbivore-ness
    this.herbivore = Life.Utils.cap(Life.Utils.randomNormal(this.herbivore, 0.03));

    //Mutate clocks
    if (Math.random() < this.mutationRate[0] * 5) {
      this.clock1 = Life.Utils.randomNormal(this.clock1, this.mutationRate[1]);
    }
    if (this.clock1 < 2) {
      this.clock1 = 2;
    }
    if (Math.random() < this.mutationRate[0] * 5) {
      this.clock2 = Life.Utils.randomNormal(this.clock2, this.mutationRate[1]);
    }
    if (this.clock2 < 2) {
      this.clock2 = 2;
    }

    //Mutate senses
    if (Math.random() < this.mutationRate[0] * 5) {
      this.smellModifier = Life.Utils.randomNormal(this.smellModifier, this.mutationRate[1]);
    }
    if (Math.random() < this.mutationRate[0] * 5) {
      this.soundModifier = Life.Utils.randomNormal(this.soundModifier, this.mutationRate[1]);
    }
    if (Math.random() < this.mutationRate[0] * 5) {
      this.hearingModifier = Life.Utils.randomNormal(this.hearingModifier, this.mutationRate[1]);
    }
    if (Math.random() < this.mutationRate[0] * 5) {
      this.eyeSenseModifier = Life.Utils.randomNormal(this.eyeSenseModifier, this.mutationRate[1]);
    }
    if (Math.random() < this.mutationRate[0] * 5) {
      this.bloodModifier = Life.Utils.randomNormal(this.bloodModifier, this.mutationRate[1]);
    }

    //Mutate Temperature preference
    this.temperaturePreference = Life.Utils.cap(Life.Utils.randomNormal(this.temperaturePreference, 0.005));

    for (var i in this.eyes) {
      var eye = this.eyes[i];
      if (Math.random() < this.mutationRate[0] * 5) {
        eye.fov = Life.Utils.randomNormal(eye.fov, this.mutationRate[1]);
      }
      if (Math.random() < this.mutationRate[0] * 5) {
        eye.direction = Life.Utils.randomNormal(eye.direction, this.mutationRate[1]);
      }
      if (eye.fov < 0.5) {
        eye.fov = 0.5;
      }
      if (eye.fov > 2) {
        eye.fov = 2;
      }
    }

    this.brain.mutate(this.mutationRate[0], this.mutationRate[1]);
  };

  /**
   * Produces a new agent with attributes randomly inherited from either itself or a partner, with mutations applied.
   * @param partner Partner agent from which some attributes may be inherited
   * @return {Life.Agent} A new agent containing a mix of the two parents' attributes
   */
  this.crossover = function(partner) {
    var agent = new Life.Agent(_parameters);
    agent.hybrid = true;
    agent.generationCount = Math.max(this.generationCount, partner.generationCount) + 1;

    //Randomise which parent attributes are inherited from
    agent.clock1 = Math.random() < 0.5 ? this.clock1 : partner.clock1;
    agent.clock2 = Math.random() < 0.5 ? this.clock2 : partner.clock2;
    agent.herbivore = Math.random() < 0.5 ? this.herbivore : partner.herbivore;
    agent.mutationRate = Math.random() < 0.5 ? this.mutationRate : partner.mutationRate;
    agent.temperaturePreference = Math.random() < 0.5 ? this.temperaturePreference : partner.temperaturePreference;

    agent.smellModifier = Math.random() < 0.5 ? this.smellModifier : partner.smellModifier;
    agent.soundModifier = Math.random() < 0.5 ? this.soundModifier : partner.soundModifier;
    agent.hearingModifier = Math.random() < 0.5 ? this.hearingModifier : partner.hearingModifier;
    agent.eyeSenseModifier = Math.random() < 0.5 ? this.eyeSenseModifier : partner.eyeSenseModifier;
    agent.bloodModifier = Math.random() < 0.5 ? this.bloodModifier : partner.bloodModifier;

    agent.eyes = Math.random() < 0.5 ? this.eyes : partner.eyes;

    agent.brain = this.brain.crossover(partner.brain);
    agent.mutate();
    return agent;
  };

  /**
   * Handles a change of parameters, rebuilding affected parts of agent if they've changed
   * @param parameters New parameters.
   */
  this.setParameters = function(parameters) {

    if (this.pos.x > parameters.width) {
      this.pos.x = parameters.width;
    }
    if (this.pos.y > parameters.height) {
      this.pos.y = parameters.height;
    }

    if (this.out.length != parameters.brain.outputSize) {
      this.out = [];
      for (var i = 0; i < parameters.brain.outputSize; i++) {
        this.out[i] = 0;
      }
    }

    if (JSON.encode(_parameters.agent.reproductionRate) != JSON.encode(parameters.agent.reproductionRate)) {
      this.repCounter = this.herbivore * ((Math.random() * 0.2) + parameters.agent.reproductionRate.herbivore - 0.1)
          + (1 - this.herbivore) * ((Math.random() * 0.2) + parameters.agent.reproductionRate.herbivore - 0.1);
    }
    if (this.eyes.length != parameters.agent.numberEyes) {
      this.eyes = [];
      for (var i = 0; i < parameters.agent.numberEyes; i++) {
        var eye = new Life.Agent.Eye(this);
        eye.fov = Math.random() * 1.5 + 0.5;
        eye.direction = Math.random() * Math.PI * 2;
        this.eyes.push(eye);
      }
    }

    this.viewDistance = _parameters.agent.viewDistance;

    this.brain.setParameters(parameters);

    _parameters = parameters;
  }
};

/**
 * Represents an agent's eye
 * @param agent Agent that this eye belongs to
 * @constructor
 */
Life.Agent.Eye = function(agent) {
  this.fov = 0;
  this.direction = 0;
  this.proximity = 0;
  this.red = 0;
  this.green = 0;
  this.blue = 0;

  this.look = function(agent, agent2) {
    var angleBetween = agent.pos.angleFromNorth(agent2.pos);
    var eyeDirection = agent.angle + this.direction - Math.PI / 2;
    if (eyeDirection < -Math.PI) {
      eyeDirection += 2 * Math.PI;
    }
    if (eyeDirection > Math.PI) {
      eyeDirection -= 2 * Math.PI;
    }

    var diff = eyeDirection - angleBetween;
    diff = (Math.abs(diff) > Math.PI) ? Math.abs(2 * Math.PI - Math.abs(diff)) : Math.abs(diff);

    var distance = agent.pos.distanceFrom(agent2.pos);
    if (diff < (this.fov / 2)) {
      var mul = agent.eyeSenseModifier * (Math.abs((this.fov / 2) - diff) / (this.fov / 2)) * ((agent.viewDistance - distance) / agent.viewDistance);

      this.proximity += mul * (distance / agent.viewDistance);
      this.red += mul * agent2.red;
      this.green += mul * agent2.green;
      this.blue += mul * agent2.blue;
    }
  };

  this.reset = function() {
    this.proximity = 0;
    this.red = 0;
    this.green = 0;
    this.blue = 0;
  };
};

/**
 * An agents brain, consisting of a number of linked boxes (similar to neurons in a biological brain)
 * @param parameters A list of parameters, see
 * <a href="https://github.com/JimAllanson/lifejs/wiki/Default-Parameters">
 *   a list of defaults here.</a>
 * @constructor
 */
Life.Brain = function(parameters) {
  var _parameters = parameters;
  this.boxes = [];
  for (var i = 0; i < _parameters.brain.size; i++) {
    this.boxes.push(new Life.Brain.Box(_parameters));
  }

  /**
   * Performs a tick of the brain, translating a list of inputs into a list of outputs
   * @param input Array of inputs to the brain, each a float value between 0 and 1.
   * @param output Array to contain outputs from the brain, each a float value between 0 and 1.
   */
  this.tick = function(input, output) {
    for (var i = 0; i < _parameters.brain.inputSize; i++) {
      this.boxes[i].output = input[i];
    }

    for (var i = _parameters.brain.inputSize; i < _parameters.brain.size; i++) {
      var box = this.boxes[i];

      var acc = 0;
      for (var j = 0; j < _parameters.brain.connections; j++) {
        var index = box.id[j];
        var type = box.type[j];
        var value = this.boxes[index].output;

        if (type == 1) {
          value -= this.boxes[index].oldOut;
          value *= 10;
        }
        acc += value * box.weight[j];
      }

      acc *= box.globalWeight;
      acc += box.bias;
      acc = 1 / (1 + Math.exp(-acc));
      box.target = acc;
    }

    for (var i = 0; i < _parameters.brain.size; i++) {
      this.boxes[i].oldOut = this.boxes[i].output;
    }

    for (var i = _parameters.brain.inputSize; i < _parameters.brain.size; i++) {
      var box = this.boxes[i];
      box.output += (box.target - box.output) * box.damper;
    }

    for (var i = 0; i < _parameters.brain.outputSize; i++) {
      output[i] = this.boxes[_parameters.brain.size - 1 - i].output;
    }
  };

  /**
   * Mutates the brain, introducing normally distributed random variations
   * @param mutationRate1 Mutation probability
   * @param mutationRate2 Mutation variance
   */
  this.mutate = function(mutationRate1, mutationRate2) {
    for (var i = 0; i < _parameters.brain.size; i++) {
      if (Math.random() < mutationRate1) {
        this.boxes[i].bias += Life.Utils.randomNormal(0, mutationRate2);
      }

      if (Math.random() < mutationRate1) {
        this.boxes[i].damper += Life.Utils.randomNormal(0, mutationRate2);
        if (this.boxes[i].damper < 0.001) {
          this.boxes[i].damper = 0.001;
        }
        if (this.boxes[i].damper > 1) {
          this.boxes[i].damper = 1;
        }
      }

      if (Math.random() < mutationRate1) {
        this.boxes[i].globalWeight += Life.Utils.randomNormal(0, mutationRate2);
        if (this.boxes[i].globalWeight < 0) {
          this.boxes[i].globalWeight = 0;
        }
      }

      if (Math.random() < mutationRate1) {
        var rc = Math.round(Math.random() * ( _parameters.brain.connections - 1));
        this.boxes[i].weight[rc] += Life.Utils.randomNormal(0, mutationRate2);
      }

      if (Math.random() < mutationRate1) {
        var rc = Math.round(Math.random() * (_parameters.brain.connections - 1));
        this.boxes[i].type[rc] = 1 - this.boxes[i].type[rc];
      }

      if (Math.random() < mutationRate1) {
        var rc = Math.round(Math.random() * (_parameters.brain.connections - 1));
        var ri = Math.round(Math.random() * (_parameters.brain.size - 1));
        this.boxes[i].id[rc] = ri;
      }
    }
  };

  /**
   * Crosses this brain with that of another agent, producing a new brain that is a mix of both parents'.
   * @param partner
   * @return {Life.Brain}
   */
  this.crossover = function(partner) {
    var brain = new Life.Brain(_parameters);
    for (var i = 0; i < brain.boxes.length; i++) {
      if (Math.random() < 0.5) {
        brain.boxes[i].bias = this.boxes[i].bias;
        brain.boxes[i].globalWeight = this.boxes[i].globalWeight;
        brain.boxes[i].damper = this.boxes[i].damper;
        for (var j = 0; j < brain.boxes[i].id.length; j++) {
          brain.boxes[i].id[j] = this.boxes[i].id[j];
          brain.boxes[i].weight[j] = this.boxes[i].weight[j];
          brain.boxes[i].type[j] = this.boxes[i].type[j];
        }
      } else {
        brain.boxes[i].bias = partner.boxes[i].bias;
        brain.boxes[i].globalWeight = partner.boxes[i].globalWeight;
        brain.boxes[i].damper = partner.boxes[i].damper;
        for (var j = 0; j < brain.boxes[i].id.length; j++) {
          brain.boxes[i].id[j] = partner.boxes[i].id[j];
          brain.boxes[i].weight[j] = partner.boxes[i].weight[j];
          brain.boxes[i].type[j] = partner.boxes[i].type[j];
        }
      }
    }
    return brain;
  };

  /**
   * Handles a change of parameters, rebuilding brain if they've changed
   * @param parameters New parameters.
   */
  this.setParameters = function(parameters) {
    if (JSON.encode(parameters.brain) != JSON.encode(_parameters.brain)) {
      this.boxes = Array();

      for (var i = 0; i < parameters.brain.size; i++) {
        this.boxes.push(new Life.Brain.Box(parameters));
      }
    } else {
      for (var i = 0; i < _parameters.brain.size; i++) {
        this.boxes[i].setParameters(parameters);
      }
    }
    _parameters = parameters;
  }
};

/**
 * A single 'neuron' of the agent's brain.
 * @param parameters A list of parameters, see
 * <a href="https://github.com/JimAllanson/lifejs/wiki/Default-Parameters">
 *   a list of defaults here.</a>
 * @constructor
 */
Life.Brain.Box = function(parameters) {
  var _parameters = parameters;

  this.weight = [];
  this.id = [];
  this.type = [];

  this.damper = Math.random() * 0.2 + 0.9;
  this.globalWeight = Math.random() * 5;
  this.bias = Math.random() * 4 - 2;

  this.target = 0;
  this.output = 0;
  this.oldOut = 0;

  for (var i = 0; i < _parameters.brain.connections; i++) {
    this.weight[i] = Math.random() * 6 - 3;
    if (Math.random() < 0.5) {
      this.weight[i] = 0;
    }

    this.id[i] = Math.round(Math.random() * (_parameters.brain.size - 1));
    if (Math.random() < 0.2) {
      this.id[i] = Math.round(Math.random() * (_parameters.brain.inputSize - 1));
    }

    this.type[i] = (Math.random() < 0.05) ? 1 : 0;
  }

  /**
   * Handles a change of parameters, rebuilding neuron if they've changed
   * @param parameters New parameters.
   */
  this.setParameters = function(parameters) {
    if (JSON.encode(parameters.brain) != JSON.encode(_parameters.brain)) {
      this.weight = [];
      this.id = [];
      this.type = [];

      for (var i = 0; i < parameters.brain.connections; i++) {
        this.weight[i] = Math.random() * 6 - 3;
        if (Math.random() < 0.5) {
          this.weight[i] = 0;
        }

        this.id[i] = Math.round(Math.random() * (parameters.brain.size - 1));
        if (Math.random() < 0.2) {
          this.id[i] = Math.round(Math.random() * (parameters.brain.inputSize - 1));
        }

        this.type[i] = (Math.random() < 0.05) ? 1 : 0;
      }
    }
    _parameters = parameters;
  }
};

/**
 * Utility functions
 */
Life.Utils = {};

/**
 * Caps a value between 0 and 1
 * @param x Value to cap
 * @return {*} x, capped between 0 and 1
 */
Life.Utils.cap = function(x) {
  if (x < 0) {
    return 0;
  }
  if (x > 1) {
    return 1;
  }

  return x;
};

/**
 * Produces a random number with normal distribution from a mean and variance.
 * @param mean The mean number to produce
 * @param variance The level of variation from the mean
 * @return {Number} A random number
 */
Life.Utils.randomNormal = function(mean, variance) {
  var variable1, variable2, squared, result;
  do {
    variable1 = 2 * Math.random() - 1;
    variable2 = 2 * Math.random() - 1;
    squared = variable1 * variable1 + variable2 * variable2;
  } while (squared > 1 || squared == 0);

  return Math.sqrt(-2 * Math.log(squared) / squared) * variable1 * Math.sqrt(variance) + mean;
};

/**
 * Produces an RGBA CSS string from four values between 0 and 1.
 * @param r Red component
 * @param g Green component
 * @param b Blue component
 * @param a Alpha component
 * @return {String} RGBA colour as a CSS string
 */
Life.Utils.rgbaToCss = function(r, g, b, a) {
  return "rgba(" + Math.floor(r * 255) + "," + Math.floor(g * 255) + "," + Math.floor(b * 255) + ", " + a + ")";
};

/**
 * Copy an object
 * @param from
 * @param to
 */
Life.Utils.copy = function(from, to) {
  for (var i in from) {
    if (typeof from[i] == "object") {
      Life.Utils.copy(from[i], to[i]);
    } else if (typeof from[i] != "undefined") {
      to[i] = from[i];
    }
  }
};

/**
 * Basic 2D Vector Math
 * @param x X coordinate of Vector
 * @param y Y coordinate of Vector
 * @constructor
 */
Life.Vector = function(x, y) {
  this.x = x;
  this.y = y;

  /**
   * Returns the distance between this vector and another.
   * @param vector The other vector
   * @return {Number} The distance between the two vectors
   */
  this.distanceFrom = function(vector) {
    return Math.sqrt(Math.pow(Math.abs(x - vector.x), 2) + Math.pow(Math.abs(y - vector.y), 2));
  };

  /**
   * Returns the angle between 'North' (π / 2) and another vector
   * @param vector Other vector
   * @return {Number} Angle in radians.
   */
  this.angleFromNorth = function(vector) {
    return Math.atan2(vector.y - this.y, vector.x - this.x) - Math.PI / 2;
  };

  /**
   * Rotates a vector around the origin by a supplied angle (in radians)
   * @param angle Angle to rotate by
   * @return {Life.Vector} New vector after rotation
   */
  this.rotate = function(angle) {
    var angle = (angle < 0) ? 2 * Math.PI + angle : angle;
    var px = (this.x * Math.cos(angle)) - (this.y * Math.sin(angle));
    var py = (this.x * Math.sin(angle)) + (this.y * Math.cos(angle));
    return new Life.Vector(px, py);
  };

  /**
   * Adds this vector to another
   * @param vector Other vector
   * @return {Life.Vector} Sum of vectors
   */
  this.add = function(vector) {
    return new Life.Vector(this.x + vector.x, this.y + vector.y);
  };

  /**
   * Subtracts another vector from this
   * @param vector Other vector
   * @return {Life.Vector} Difference between vectors
   */
  this.subtract = function(vector) {
    return new Life.Vector(this.x - vector.x, this.y - vector.y);
  };
};

var _selectedAgent = null;
var _world;
var _pause = false;
var _timer;

/**
 * Creates a simulation an schedules a new tick at the specified frequency
 * @param parameters A list of parameters, see
 * <a href="https://github.com/JimAllanson/lifejs/wiki/Default-Parameters">
 *   a list of defaults here.</a>
 */
function init(parameters) {
  _world = new Life.World(parameters);
  _selectedAgent = _world.agents[0];
  _world.agents[0].selectFlag = true;
  _timer = setInterval(tick, _world.parameters.tickDuration);
}

/**
 *
 * @param world
 */
function load(world) {
  _world = new Life.World(world.parameters);
  Life.Utils.copy(world, _world);
  _selectedAgent = _world.agents[0];
  _world.agents[0].selectFlag = true;
  clearInterval(_timer);
  _timer = setInterval(tick, _world.parameters.tickDuration);
}

/**
 * Updates the simulation and posts data back to the Renderer
 */
function tick() {
  if (!_pause) {

    _world.update();

    //Strips brain data from agents before posting back for performance
    var agents = Array();
    for (var id in _world.agents) {
      var agent = {};
      for (var attr in _world.agents[id]) {
        if (attr != "brain") {
          agent[attr] = _world.agents[id][attr];
        }
      }
      agents.push(agent);
    }
    //Send the world and currently selected agent
    var world = {agents: agents, food: _world.food, tick: _world.tick, parameters: _world.parameters};
    self.postMessage(JSON.stringify({action: "update", world: world, agent: _selectedAgent}))
  }
}

/**
 * Selects the nearest agent to a given x and y coordinate
 * @param x X coordinate
 * @param y Y coordinate
 */
function selectAgent(x, y) {
  var minD = 1e10;
  var minI = 1;
  var d;

  for (var i = 0; i < _world.agents.length; i++) {
    d = Math.pow(x - _world.agents[i].pos.x, 2) + Math.pow(y - _world.agents[i].pos.y, 2);
    if (d < minD) {
      minD = d;
      minI = i;
    }
  }

  for (var i = 0; i < _world.agents.length; i++) {
    _world.agents[i].selectFlag = false;
  }
  _world.agents[minI].selectFlag = true;
  _selectedAgent = _world.agents[minI];
}

/**
 * Processes incoming messages from the renderer
 * @param event Object containing message data
 */
self.onmessage = function(event) {
  var data = event.data;
  if (data.action == "init") {
    init(data.parameters);
  } else if (data.action == "select") {
    selectAgent(data.parameters.x, data.parameters.y);
  } else if (data.action == "pause") {
    _pause = !_pause;
  } else if (data.action == "setParameters") {
    _world.setParameters(data.parameters);
  } else if (data.action == "save") {
    self.postMessage(JSON.stringify({action: "save", world: _world}));
  } else if (data.action == "load") {
    load(data.world);
  } else if (data.action == "clone") {
    _world.asexuallyReproduce(_selectedAgent);
  } else if (data.action == "kill") {
    _selectedAgent.health = 0;
  }

}



