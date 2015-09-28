(function (global) {
    "use strict";

    /**
     * World object contains many agents and walls and food and stuff
     * @returns {WaterWorld}
     * @constructor
     */
    var WaterWorld = function () {
        this.canvas = document.getElementById("world");
        this.xCount = 4;
        this.yCount = 4;
        this.numItems = 360;
        this.closed = true;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.maze = new Maze(this);
        this.grid = this.maze.grid;
        this.walls = this.maze.walls;

        // Reward graphing type
        this.useFlot = true;
        this.useGraph = false;

        // Collision type
        this.CD = {
            type: 'quad',
            maxChildren: 2,
            maxDepth: 10
        };
        this.cheats = {
            quad: true,
            grid: false,
            population: false,
            walls: false
        };

        var agentOpts = {
            brainType: 'RLDQN',
            numEyes: 30,
            numTypes: 5,
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
        };

        var agentWOpts = {
            brainType: 'RLDQN',
            numEyes: 30,
            numTypes: 5,
            radius: 10,
            collision: true,
            interactive: false,
            useSprite: false,
            cheats: {
                gridLocation: false,
                position: false,
                id: false,
                name: true
            },
            worker: true
        };

        var entityOpts = {
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

        var vec1 = new Vec(Utility.randi(3, this.canvas.width - 2), Utility.randi(3, this.canvas.height - 2)),
            vec2 = new Vec(Utility.randi(3, this.canvas.width - 2), Utility.randi(3, this.canvas.height - 2));

        this.agents = [
            new AgentRLDQN(vec1, agentOpts),
            new AgentRLDQN(vec2, agentWOpts)
        ];

        this.agents[0].load('zoo/wateragent.json');
        this.agents[1].load('zoo/wateragent.json');

        World.call(this, this, entityOpts);

        return this;
    };

    WaterWorld.prototype = Object.create(World.prototype);
    WaterWorld.prototype.constructor = World;

    global.WaterWorld = WaterWorld;

}(this));
