/**
 * Original code borrowed from https://github.com/felipecsl/random-maze-generator
 *
 */
(function (global) {
    "use strict";

    /**
     * A maze
     * @param {Object} opts
     * @returns {undefined}
     */
    var Maze = function (opts) {
        this.xCount = opts.xCount;
        this.yCount = opts.yCount;
        this.width = opts.width;
        this.height = opts.height;

        this.cellWidth = this.width / this.xCount;
        this.cellHeight = this.height / this.yCount;
        this.walls = [];
        this.cellStack = [];
        this.path = [];

        this.grid = new Grid(this);

        this.draw(opts.closed);

        this.solve();

        return this;
    };

    /**
     * Add a Wall to the Maze
     * @param {Vec} v1
     * @param {Vec} v2
     * @returns {undefined}
     */
    Maze.prototype.addWall = function (v1, v2) {
        this.walls.push(new Wall(v1, v2));
    };

    /**
     * Return the walls
     * @returns {Array}
     */
    Maze.prototype.walls = function () {
        return this.walls;
    };

    /**
     * Return the Graph's Cells
     * @returns {Array}
     */
    Maze.prototype.graphCells = function () {
        return this.grid.cells;
    };

    /**
     * Draw it
     * @returns {undefined}
     */
    Maze.prototype.draw = function (closed) {
        this.generate();
        this.drawBorders(closed);
        this.drawMaze();
    };

    /**
     * Draw the borders
     * @returns {undefined}
     */
    Maze.prototype.drawBorders = function (closed) {
        this.addWall(new Vec(closed ? 2 : this.cellWidth, 2), new Vec(this.width - 2, 2));
        this.addWall(new Vec(this.width - 2, 2), new Vec(this.width - 2, this.height - 2));
        this.addWall(new Vec(this.width - (closed ? 2 : this.cellWidth), this.height - 2), new Vec(2, this.height - 2));
        this.addWall(new Vec(2, this.height - 2), new Vec(2, 2));
    };

    /**
     * Draw the solution
     * @returns {undefined}
     */
    Maze.prototype.drawSolution = function (canvas) {
        var ctx = canvas.getContext("2d"),
            _ctx = ctx,
            _this = this,
            path = this.path;
        ctx.fillStyle = "rgba(0,165,0,.1)";
        ctx.strokeStyle = "rgb(0,0,0)";
        for (var i = 0; i < this.path.length; i++) {
            var V = path[i];
            var vW = this.cellWidth,
                vH = this.cellHeight,
                vX = V.x,
                vY = V.y,
            // Get the cell X coords and multiply by the cell width
                x = _this.grid.cells[vX][vY].x * vW,
            // Get the cell Y coords and multiply by the cell height
                y = _this.grid.cells[vX][vY].y * vH;
            (function () {
                _ctx.fillRect(x, y, vW, vH);
            })();
        }
    };

    /**
     * Draw the Maze
     * @returns {undefined}
     */
    Maze.prototype.drawMaze = function () {
        var grid = this.grid,
            drawnEdges = [];

        var edgeAlreadyDrawn = function (v1, v2) {
            return _.detect(drawnEdges, function (edge) {
                    return _.include(edge, v1) && _.include(edge, v2);
                }) !== undefined;
        };

        for (var i = 0; i < grid.xCount; i++) {
            for (var j = 0; j < grid.yCount; j++) {
                var v = grid.cells[i][j],
                    topV = grid.getCellAt(v.x, v.y - 1),
                    leftV = grid.getCellAt(v.x - 1, v.y),
                    rightV = grid.getCellAt(v.x + 1, v.y),
                    bottomV = grid.getCellAt(v.x, v.y + 1);

                if (!edgeAlreadyDrawn(v, topV) && grid.areConnected(v, topV)) {
                    var x1 = v.x * this.cellWidth,
                        y1 = v.y * this.cellHeight,
                        x2 = x1 + this.cellWidth,
                        y2 = y1;

                    this.addWall(new Vec(x1, y1), new Vec(x2, y2));
                    drawnEdges.push([v, topV]);
                }

                if (!edgeAlreadyDrawn(v, leftV) && grid.areConnected(v, leftV)) {
                    var x2 = x1,
                        y2 = y1 + this.cellHeight;

                    this.addWall(new Vec(x1, y1), new Vec(x2, y2));
                    drawnEdges.push([v, leftV]);
                }

                if (!edgeAlreadyDrawn(v, rightV) && grid.areConnected(v, rightV)) {
                    var x1 = (v.x * this.cellWidth) + this.cellWidth,
                        y1 = v.y * this.cellHeight,
                        x2 = x1,
                        y2 = y1 + this.cellHeight;

                    this.addWall(new Vec(x1, y1), new Vec(x2, y2));
                    drawnEdges.push([v, rightV]);
                }

                if (!edgeAlreadyDrawn(v, bottomV) && grid.areConnected(v, bottomV)) {
                    var x1 = v.x * this.cellWidth,
                        y1 = (v.y * this.cellHeight) + this.cellHeight,
                        x2 = x1 + this.cellWidth,
                        y2 = y1;

                    this.addWall(new Vec(x1, y1), new Vec(x2, y2));
                    drawnEdges.push([v, bottomV]);
                }
            }
        }
    };

    /**
     * Build the maze
     * @returns {undefined}
     */
    Maze.prototype.generate = function () {
        var initialCell = this.grid.getCellAt(0, 0);
        this.recurse(initialCell);
    };

    /**
     * Recurse through a Cell's neighbors
     * @param {Cell} cell
     * @returns {undefined}
     */
    Maze.prototype.recurse = function (cell) {
        cell.visit();
        var neighbors = this.grid.unvisitedNeighbors(cell);
        if (neighbors.length > 0) {
            var randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
            this.cellStack.push(cell);
            this.grid.removeEdgeBetween(cell, randomNeighbor);
            this.recurse(randomNeighbor);
        } else {
            var waitingCell = this.cellStack.pop();
            if (waitingCell) {
                this.recurse(waitingCell);
            }
        }
    };

    /**
     * Solve the Maze
     * @returns {undefined}
     */
    Maze.prototype.solve = function () {
        var closedSet = [],
        // Top left cell
            startCell = this.grid.getCellAt(0, 0),
        // Bottom right cell
            targetCell = this.grid.getCellAt(this.xCount - 1, this.yCount - 1),
            openSet = [startCell],
            searchCell = startCell;

        while (openSet.length > 0) {
            var neighbors = this.grid.disconnectedNeighbors(searchCell);
            for (var i = 0; i < neighbors.length; i++) {
                var neighbor = neighbors[i];
                if (neighbor === targetCell) {
                    neighbor.parent = searchCell;
                    this.path = neighbor.pathToOrigin();
                    this.grid.path = this.path;
                    openSet = [];
                    return;
                }
                if (!_.include(closedSet, neighbor)) {
                    if (!_.include(openSet, neighbor)) {
                        openSet.push(neighbor);
                        neighbor.parent = searchCell;
                        neighbor.heuristic = neighbor.score() + this.grid.getCellDistance(neighbor, targetCell);
                    }
                }
            }
            closedSet.push(searchCell);
            openSet.remove(_.indexOf(openSet, searchCell));
            searchCell = null;

            _.each(openSet, function (cell) {
                if (!searchCell) {
                    searchCell = cell;
                } else if (searchCell.heuristic > cell.heuristic) {
                    searchCell = cell;
                }
            });
        }
    };

    global.Maze = Maze;

}(this));