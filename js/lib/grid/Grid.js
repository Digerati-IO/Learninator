/**
 * Original code borrowed from https://github.com/felipecsl/random-maze-generator
 */
(function (global) {
    "use strict";

    var Utility = global.Utility || {},
        Cell = global.Cell || {},
        CellShape = global.CellShape || {},
        Point = global.Point || {};

    class Grid {

        /**
         * Grid
         * @name Grid
         * @constructor
         *
         * @param {object} opts - The options for the Grid
         * @param {number} opts.width - The width
         * @param {number} opts.height - The height
         * @param {boolean} opts.cheats - The display flag
         * @param {number} opts.buffer - The buffer
         * @param {number} opts.size -
         * @param {number} opts.cellSize -
         * @param {number} opts.cellSpacing -
         * @param {boolean} opts.pointy -
         * @param {boolean} opts.fill -
         * @param {array} cells -
         * @returns {Grid}
         */
        constructor(opts, cells) {
            this.width = Utility.getOpt(opts, 'width', 600);
            this.height = Utility.getOpt(opts, 'height', 600);
            this.buffer = Utility.getOpt(opts, 'buffer', 0);
            this.size = Utility.getOpt(opts, 'size', 5);
            this.cellSize = Utility.getOpt(opts, 'cellSize', 20);
            this.cellSpacing = Utility.getOpt(opts, 'cellSpacing', 0);
            this.pointy = Utility.getOpt(opts, 'pointy', false);
            this.fill = Utility.getOpt(opts, 'fill', false);
            this.cheats = Utility.getOpt(opts, 'cheats', false);
            this.xCount = this.width / this.cellSize;
            this.yCount = this.height / this.cellSize;
            this.cellWidth = (this.width - this.buffer) / this.xCount;
            this.cellHeight = (this.height - this.buffer) / this.yCount;
            this.cells = cells || Grid.shapeRectangle(this.xCount, this.yCount, this.cellSize, this.fill, this.cheats);
            this.path = [];
            this.removedEdges = [];
            this.walls = [];

            this.map = new Map();
            this.mapCells();

            this.cellsContainer = new PIXI.Container();
            this.cells.forEach((cell) => {
                cell.neighbors = this.neighbors(cell);
                this.cellsContainer.addChild(cell.shape);
            });

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
         * @param {Cell} c
         * @returns {Array}
         */
        connectedNeighbors(c) {
            var con;
            return _.select(this.neighbors(c), (c0) => {
                con = this.areConnected(c, c0);

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
            var disc;
            return _.reject(this.neighbors(cell), (c0) => {
                disc = this.areConnected(cell, c0);

                return disc;
            });
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
         * Return the centered location of the entity within a grid
         * @param {Cell} cell
         * @returns {Object}
         */
        getCenterXY(cell) {
            let x = cell.corners[0].x + (this.cellWidth / 2),
                y = cell.corners[0].y + (this.cellHeight / 2);

            return new Point(x, y);
        }

        /**
         * Return the grid
         * @returns {Grid}
         */
        getGrid() {
            return this;
        }

        /**
         * Return the location of the entity within a grid
         * @param {Entity} entity
         * @returns {Cell|boolean}
         */
        getGridLocation(entity) {
            let x = entity.bounds.x + (entity.bounds.width/2),
                y = entity.bounds.y + (entity.bounds.height/2),
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
         * @returns {Array}
         */
        neighbors(cell) {
            let neighbors = [];
            if (cell !== null) {
                let u = cell.direction(cell, 0),
                    r = cell.direction(cell, 1),
                    d = cell.direction(cell, 2),
                    l = cell.direction(cell, 3);

                neighbors[0] = this.getCellAt(u.x, u.y);
                neighbors[1] = this.getCellAt(r.x, r.y);
                neighbors[2] = this.getCellAt(d.x, d.y);
                neighbors[3] = this.getCellAt(l.x, l.y);
            }
            return neighbors;
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
         * @param {number} w
         * @param {number} h
         * @param {number} size
         * @param {boolean} fill
         * @param {object} cheats
         * @returns {Array}
         */
        static shapeRectangle(w, h, size, fill, cheats) {
            let cells = [];
            for (let x = 0; x < w; x++) {
                for (let y = 0; y < h; y++) {
                    let cell = new Cell(x, y, size),
                        cellShape = new CellShape(cell, fill, cheats);
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
            c.neighbors.forEach((cell) => {
                if (cell && !cell.visited) {
                    unv.push(cell);
                }
            });

            return unv;
        }
    }
    global.Grid = Grid;

}(this));
