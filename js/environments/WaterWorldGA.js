var WaterWorldGA = WaterWorldGA || {},
    convnetjs = convnetjs || {},
    GATrainer = GATrainer || {},
    Maze = Maze || {},
    Utility = Utility || {},
    Vec = Vec || {},
    World = World || {};

(function (global) {
    "use strict";

    /**
     *
     * @param chromosome
     * @returns {number}
     */
    function matchFunction(chromosome) { // this function is passed to trainer.
        var result = 0;
        // put chromosomes into brains before getting them to duel it out.
        world.agents[0].brain.populate(chromosome);

        result = world.update(30 * 20);

        return result; // -1 means chromosome1 beat chromosome2, 1 means vice versa, 0 means tie.
    }

    /**
     *
     * @param brain
     * @param initialGene
     * @constructor
     */
    function Trainer(brain, initialGene) {
        this.net = new convnetjs.Net();
        this.net.makeLayers(brain.layerDefs);
        this.trainer = new GATrainer({
            populationSize: 100 * 1,
            mutationSize: 0.3,
            mutationRate: 0.05,
            numMatch: 4 * 2,
            elitePercentage: 0.20
        }, initialGene);

        return this;
    }

    /**
     *
     */
    Trainer.prototype.train = function () {
        this.trainer.train(matchFunction);
    };

    /**
     *
     * @param n
     * @returns {*}
     */
    Trainer.prototype.getChromosome = function (n) {
        // returns a copy of the nth best chromosome (if not provided, returns first one, which is the best one)
        n = n || 0;
        return this.trainer.chromosomes[n].clone();
    };

    /**
     * World object contains many agents and walls and food and stuff
     * @name WaterWorldGA
     * @extends World
     * @constructor
     *
     * @returns {WaterWorldGA}
     */
    function WaterWorldGA() {
        var self = this;

        this.width = 600;
        this.height = 600;
        this.mazeOptions = {
            xCount: 4,
            yCount: 4,
            width: this.width,
            height: this.height,
            closed: true
        };
        this.maze = new Maze(this.mazeOptions);
        this.grid = this.maze.grid;
        this.walls = this.maze.walls;
        this.numItems = 1;

        // Cheats to display
        this.cheats = {
            quad: true,
            grid: false,
            walls: false
        };

        this.entityOpts = {
            radius: Utility.randi(5, 10),
            collision: true,
            interactive: false,
            useSprite: false,
            movingEntities: true,
            cheats: {
                gridLocation: false,
                position: false,
                id: false,
                name: false
            }
        };

        this.agents = [
            new AgentGA(new Vec(Utility.randi(3, this.width - 2), Utility.randi(3, this.height - 2)),
                {
                    brainType: 'GA',
                    env: {
                        getNumStates: function () {
                            return 30 * 5;
                        },
                        getMaxNumActions: function () {
                            return 4;
                        },
                        startState: function () {
                            return 0;
                        }
                    },
                    numActions: 4,
                    numStates: 30 * 5,
                    numEyes: 30,
                    numTypes: 5,
                    range: 120,
                    proximity: 120,
                    radius: 10,
                    collision: true,
                    interactive: false,
                    useSprite: false,
                    cheats: {
                        gridLocation: false,
                        position: false,
                        id: false,
                        name: true
                    }
                }),
            new AgentGA(new Vec(Utility.randi(3, this.width - 2), Utility.randi(3, this.height - 2)),
                {
                    brainType: 'GA',
                    env: {
                        getNumStates: function () {
                            return 30 * 5;
                        },
                        getMaxNumActions: function () {
                            return 4;
                        },
                        startState: function () {
                            return 0;
                        }
                    },
                    numActions: 4,
                    numStates: 30 * 5,
                    numEyes: 30,
                    numTypes: 5,
                    range: 120,
                    proximity: 120,
                    radius: 10,
                    collision: true,
                    interactive: false,
                    useSprite: false,
                    cheats: {
                        gridLocation: false,
                        position: false,
                        id: false,
                        name: true
                    }
                })
        ];
        this.agents[0].setTarget(this.agents[1]);
        this.agents[1].setTarget(this.agents[0]);

        World.call(this, this, this.entityOpts);

        this.trainer = new Trainer(this.agents[0].brain);
        this.agents[0].brain.populate(this.trainer.getChromosome()); // best one
        this.agents[1].brain.populate(this.trainer.getChromosome()); // best one

        return this;
    }

    WaterWorldGA.prototype = Object.create(World.prototype);
    WaterWorldGA.prototype.constructor = World;

    /**
     *
     */
    WaterWorldGA.prototype.tick = function () {
        this.update(1);
        let genStep = 50;
        for (let i = 0; i < genStep; i++) {
            this.trainer.train();
        }

        this.agents[0].brain.populate(this.trainer.getChromosome(0)); // best one
        this.agents[1].brain.populate(this.trainer.getChromosome(1)); // second best one
    };

    /**
     *
     * @param nStep
     * @returns {number}
     */
    WaterWorldGA.prototype.update = function (nStep) {
        let result = 0;
        for (let step = 0; step < nStep; step++) {
            // ai here
            // update internal states
            this.agents[0].getState(this.entities[0]);
            this.agents[1].getState(this.entities[0]);
            // push states to brain
            this.agents[0].brain.setCurrentInputState(this.agents[0], this.agents[1]);
            this.agents[1].brain.setCurrentInputState(this.agents[1], this.agents[0]);
            // make a decision
            this.agents[0].brain.forward();
            this.agents[1].brain.forward();
            // convert brain's output signals into game actions
            this.agents[0].setBrainAction();
            this.agents[1].setBrainAction();
            // process actions
            this.agents[0].processAction();
            this.agents[1].processAction();
            this.agents[0].update(this);
            this.agents[1].update(this);
        }

        return result; // 0 means tie, -1 means landed on left side, 1 means landed on right side.
    };

    global.WaterWorldGA = WaterWorldGA;

}(this));
