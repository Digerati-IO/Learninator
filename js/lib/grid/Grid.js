/**
 * Original code borrowed from https://github.com/felipecsl/random-maze-generator
 */
(function (global) {
    "use strict";

    var Utility = global.Utility || {},
        Cell = global.Cell || {},
        CellShape = global.CellShape || {},
        Point = global.Point || {};

    /**
     * The grid options
     * @typedef {Object} gridOpts
     * @property {number} width
     * @property {number} height
     * @property {number} buffer
     * @property {number} size
     * @property {number} cellSize
     * @property {number} cellSpacing
     * @property {boolean} pointy
     * @property {boolean} useSprite
     * @property {boolean} fill
     * @property {cheatsOpts} cheats
     */

    class Grid {

        /**
         * Grid
         * @name Grid
         * @constructor
         *
         * @param {Layout} layout -
         * @param {Array} cells -
         * @param {gridOpts} opts - The options for the Grid
         * @returns {Grid}
         */
        constructor(layout, cells,  opts) {
            this.width = Utility.getOpt(opts, 'width', 600);
            this.height = Utility.getOpt(opts, 'height', 600);
            this.buffer = Utility.getOpt(opts, 'buffer', 0);
            this.size = Utility.getOpt(opts, 'size', 5);
            this.cellSize = Utility.getOpt(opts, 'cellSize', 20);
            this.cellSpacing = Utility.getOpt(opts, 'cellSpacing', 0);
            this.pointy = Utility.getOpt(opts, 'pointy', false);
            this.useSprite = Utility.getOpt(opts, 'useSprite', false);
            this.fill = Utility.getOpt(opts, 'fill', false);
            this.cheats = Utility.getOpt(opts, 'cheats', false);
            this.xCount = this.width / this.cellSize;
            this.yCount = this.height / this.cellSize;
            this.cellWidth = (this.width - this.buffer) / this.xCount;
            this.cellHeight = (this.height - this.buffer) / this.yCount;
            this.layout = layout || {};
            this.cells = cells || Grid.shapeRectangle(this.xCount, this.yCount, this.cellSize, this.fill, this.cheats);
            this.path = [];
            this.removedEdges = [];
            this.walls = [];
            this.map = new Map();

            return this;
        }

        init() {
            this.mapCells();
            this.cellsContainer = new PIXI.Container();
            this.cells.forEach((cell) => {
                for (let dir = 0; dir < 4; dir++) {
                    let neighb = cell.neighbor(cell, dir),
                        v1, v2;

                    switch (dir) {
                        case 0:
                            v1 = cell.corners[0];
                            v2 = cell.corners[1];
                            break;
                        case 1:
                            v1 = cell.corners[1];
                            v2 = cell.corners[2];
                            break;
                        case 2:
                            v1 = cell.corners[3];
                            v2 = cell.corners[2];
                            break;
                        case 3:
                            v1 = cell.corners[0];
                            v2 = cell.corners[3];
                            break;
                    }

                    cell.neighbors[dir] = this.getCellAt(neighb.x, neighb.y);
                    cell.walls[dir] = new Wall(v1, v2, dir, {cheats: this.cheats, sprite: 'stone_wall.png'});
                }
                this.cellsContainer.addChild(cell.graphics);
            });
            this.startCell = this.getCellAt(this.cells[0].x, this.cells[0].y);

            return this;
        }

        /**
         * Returns true if there is an edge between c1 and c2
         * @param {Cell} c1
         * @param {Cell} c2
         * @returns {boolean}
         */
        areConnected(c1, c2) {
            if (!c1 || !c2) {
                return false;
            }

            if (Math.abs(c1.x - c2.x) > 1 || Math.abs(c1.y - c2.y) > 1) {
                return false;
            }

            var removedEdge = _.detect(this.removedEdges, function (edge) {
                return _.include(edge, c1) && _.include(edge, c2);
            });

            return removedEdge === undefined;
        }

        /**
         * Returns all neighbors of this Cell that are separated by an edge
         * @param {Cell} cell
         * @returns {Array}
         */
        connectedNeighbors(cell) {
            var con;
            return _.select(this.neighbors(cell/*, true*/), (c0) => {
                con = this.areConnected(cell, c0);

                return con;
            });
        }

        /**
         * Returns all neighbors of this Cell that are NOT separated by an edge
         * This means there is a maze path between both cells.
         * @param {Cell} cell
         * @returns {Array}
         */
        disconnectedNeighbors(cell) {
            var disc, neighbors = this.neighbors(cell), results = [];
            results = _.reject(neighbors, (c0) => {
                if (c0 === false) {
                    return true;
                }
                disc = this.areConnected(cell, c0);

                return disc;
            });

            return results;
        }

        /**
         * Get a Cell at a specific point
         * @param {number} x
         * @param {number} y
         * @returns {Cell|boolean}
         */
        getCellAt(x, y) {
            let column = this.map.get(x),
                row = column ? column.get(y) : false,
                cell = row ? row.get(-x - y) : false;

            return cell;
        }

        /**
         * Get the distance between two Cells
         * @param {Cell} c1
         * @param {Cell} c2
         * @returns {number}
         */
        getCellDistance(c1, c2) {
            var xDist = Math.abs(c1.x - c2.x),
                yDist = Math.abs(c1.y - c2.y);

            return Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
        }

        /**
         * Return the location of the entity within a grid
         * @param {Entity} entity
         * @returns {Cell|boolean}
         */
        getGridLocation(entity) {
            let x = entity.bounds.x + (entity.bounds.width / 2),
                y = entity.bounds.y + (entity.bounds.height / 2),
                cell = this.pixelToCell(x, y);

            return cell;
        }

        /**
         * Add the cells to a hash map
         */
        mapCells() {
            let column, row, c;
            this.cells.forEach((cell) => {
                // check x
                column = this.map.get(cell.x);
                if (!column) {
                    this.map.set(cell.x, new Map());
                    column = this.map.get(cell.x);
                }
                // check y
                row = column.get(cell.y);
                if (!row) {
                    column.set(cell.y, new Map());
                    row = column.get(cell.y);
                }
                // check s
                c = row.get(-cell.x - cell.y);
                if (!c) {
                    row.set(-cell.x - cell.y, cell);
                    cell = row.get(-cell.x - cell.y);
                }
            });

            return this;
        }

        /**
         * Returns all neighbors of this cell, regardless if they are connected or not.
         * @param {Cell} cell
         * @param {boolean} all
         * @returns {Array}
         */
        neighbors(cell, all = false) {
            let neighbors = [], cells = [];
            if (cell !== null) {
                cells[0] = cell.neighbor(cell, 0);
                cells[1] = cell.neighbor(cell, 1);
                cells[2] = cell.neighbor(cell, 2);
                cells[3] = cell.neighbor(cell, 3);
                neighbors[0] = this.getCellAt(cells[0].x, cells[0].y);
                neighbors[1] = this.getCellAt(cells[1].x, cells[1].y);
                neighbors[2] = this.getCellAt(cells[2].x, cells[2].y);
                neighbors[3] = this.getCellAt(cells[3].x, cells[3].y);
            }
            return all ? cells : neighbors;
        }

        /**
         * @param {number} x
         * @param {number} y
         */
        pixelToCell(x, y) {
            var foundCell = false;
            this.cells.forEach((cell) => {
                let inIt = x >= cell.corners[0].x &&
                    x <= cell.corners[2].x &&
                    y >= cell.corners[0].y &&
                    y <= cell.corners[2].y;
                if (inIt) {
                    foundCell = cell;
                }
            });

            return foundCell;
        }

        /**
         * Remove the edge from between two Cells
         * @param {Cell} c1
         * @param {Cell} c2
         */
        removeEdgeBetween(c1, c2) {
            this.removedEdges.push([c1, c2]);

            return this;
        }

        /**
         * Create a rectangle of Cells
         * @param {gridOpts} opts
         * @returns {Array}
         */
        static shapeRectangle(opts) {
            let cells = [];
            for (let x = 0; x < opts.size; x++) {
                for (let y = 0; y < opts.size; y++) {
                    let cell = new Cell(x, y),
                        cellShape = new CellShape(cell, opts);
                    cells.push(cellShape);
                }
            }

            return cells;
        }

        /**
         * Returns all neighbors of this Cell that aren't separated by an edge
         * @param {Cell} c
         * @returns {Array}
         */
        unvisitedNeighbors(c) {
            var unv = [];
            c.neighbors.forEach((cell, dir) => {
                if (cell && !cell.visited) {
                    unv.push(cell);
                }
            });

            return unv;
        }
    }
    global.Grid = Grid;

}(this));
