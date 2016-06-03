(function (global) {
    "use strict";

    class HexWorld extends World {
        /**
         * A Hexagonal world
         * @name HexWorld
         * @extends World
         * @constructor
         *
         * @returns {HexWorld}
         */
        constructor() {
            let renderOpts = {
                    antialiasing: false,
                    autoResize: false,
                    resizable: false,
                    transparent: false,
                    resolution: 1,//window.devicePixelRatio,
                    width: 800,
                    height: 800
                },
                cheats = {
                    id: false,
                    name: false,
                    angle: false,
                    bounds: true,
                    direction: false,
                    gridLocation: false,
                    position: false
                },
                agentOpts = {
                    brainType: 'RL.DQNAgent',
                    worker: false,
                    range: 90,
                    proximity: 90,
                    radius: 10,
                    numEyes: 30,
                    numTypes: 5,
                    numActions: 4,
                    numProprioception: 2,
                    collision: true,
                    interactive: false,
                    useSprite: false,
                    cheats: cheats
                },
                gridOpts = {
                    width: renderOpts.width,
                    height: renderOpts.height,
                    buffer: 0,
                    cellSize: 20,
                    cellSpacing: 0,
                    size: 8,
                    pointy: false,
                    fill: false,
                    cheats: cheats
                },
                orientation = (gridOpts.pointy ? Layout.layoutPointy : Layout.layoutFlat),
                size = new Point(gridOpts.width / gridOpts.cellSize, gridOpts.height / gridOpts.cellSize),
                origin = new Point(gridOpts.width / 2, gridOpts.height / 2),
                layout = new Layout(orientation, size, origin),
                shape = HexGrid.shapeRectangle(gridOpts.size, gridOpts.size, gridOpts.cellSize, layout, gridOpts.fill, gridOpts.cheats, gridOpts.pointy),
                // shape = HexGrid.shapeHexagon(gridOpts.size, gridOpts.cellSize, layout, gridOpts.fill, gridOpts.cheats),
                // shape = HexGrid.shapeRing(0, 0, 2, gridOpts.cellSize, layout, gridOpts.fill, gridOpts.cheats),
                // shape = HexGrid.shapeParallelogram(-1, -2, 1, 1, gridOpts.cellSize, layout, gridOpts.fill, gridOpts.cheats),
                // shape = HexGrid.shapeTrapezoidal(-1, 1, -2, 1, false, gridOpts.cellSize, layout, gridOpts.fill, gridOpts.cheats),
                // shape = HexGrid.shapeTriangle1(2, gridOpts.cellSize, layout, gridOpts.fill, gridOpts.cheats),
                // shape = HexGrid.shapeTriangle2(2, gridOpts.cellSize, layout, gridOpts.fill, gridOpts.cheats),
                grid = new HexGrid(gridOpts, shape, layout),
                maze = new Maze(grid.init()),
                agents = [
                    new Agent(new Vec(grid.startCell.center.x, grid.startCell.center.y), agentOpts),
                    new Agent(new Vec(grid.startCell.center.x, grid.startCell.center.y), agentOpts)
                ],
                worldOpts = {
                    simSpeed: 1,
                    cheats: cheats,
                    grid: maze.grid,
                    maze: maze,
                    collision: {
                        type: 'grid'
                    },
                    numEntities: 20,
                    entityOpts: {
                        radius: 10,
                        collision: true,
                        interactive: true,
                        useSprite: false,
                        moving: true,
                        cheats: cheats
                    }
                };

            super(agents, maze.walls, worldOpts, renderOpts);
            // this.agents[0].load('zoo/wateragent.json');
            // this.agents[1].load('zoo/wateragent.json');

            this.init();

            datGUI(this);

            return this;
        }

        drawSolution() {
            this.maze.drawSolution(this.stage);
        }
    }
    global.HexWorld = HexWorld;

}(this));
