CollisionDetector.prototype.collideRect =
    function (collider, collidee) {

        // Store the collider and collidee edges
        var l1 = collider.getLeft();
        var t1 = collider.getTop();
        var r1 = collider.getRight();
        var b1 = collider.getBottom();

        var l2 = collidee.getLeft();
        var t2 = collidee.getTop();
        var r2 = collidee.getRight();
        var b2 = collidee.getBottom();

        // If the any of the edges are beyond any of the
        // others, then we know that the box cannot be
        // colliding
        if (b1 < t2 || t1 > b2 || r1 < l2 || l1 > r2) {
            return false;
        }

        // If the algorithm made it here, it had to collide
        return true;
    };

CollisionDetector.prototype.resolveElastic =
    function (player, entity) {
        // Find the mid points of the entity and player
        var pMidX = player.getMidX(),
            pMidY = player.getMidY(),
            aMidX = entity.getMidX(),
            aMidY = entity.getMidY();

        // To find the side of entry calculate based on
        // the normalized sides
        var dx = (aMidX - pMidX) / entity.halfWidth,
            dy = (aMidY - pMidY) / entity.halfHeight;

        // Calculate the absolute change in x and y
        var absDX = abs(dx),
            absDY = abs(dy);

        // If the distance between the normalized x and y
        // position is less than a small threshold (.1 in this case)
        // then this object is approaching from a corner
        if (abs(absDX - absDY) < .1) {
            // If the player is approaching from positive X
            if (dx < 0) {
                // Set the player x to the right side
                player.x = entity.getRight();

                // If the player is approaching from negative X
            } else {
                // Set the player x to the left side
                player.x = entity.getLeft() - player.width;
            }

            // If the player is approaching from positive Y
            if (dy < 0) {
                // Set the player y to the bottom
                player.y = entity.getBottom();

                // If the player is approaching from negative Y
            } else {
                // Set the player y to the top
                player.y = entity.getTop() - player.height;
            }

            // Randomly select a x/y direction to reflect velocity on
            if (Math.random() < .5) {
                // Reflect the velocity at a reduced rate
                player.vx = -player.vx * entity.restitution;

                // If the object’s velocity is nearing 0, set it to 0
                // STICKY_THRESHOLD is set to .0004
                if (abs(player.vx) < STICKY_THRESHOLD) {
                    player.vx = 0;
                }
            } else {
                player.vy = -player.vy * entity.restitution;
                if (abs(player.vy) < STICKY_THRESHOLD) {
                    player.vy = 0;
                }
            }
            // If the object is approaching from the sides
        } else if (absDX > absDY) {
            // If the player is approaching from positive X
            if (dx < 0) {
                player.x = entity.getRight();
            } else {
                // If the player is approaching from negative X
                player.x = entity.getLeft() - player.width;
            }

            // Velocity component
            player.vx = -player.vx * entity.restitution;

            if (abs(player.vx) < STICKY_THRESHOLD) {
                player.vx = 0;
            }
            // If this collision is coming from the top or bottom more
        } else {

            // If the player is approaching from positive Y
            if (dy < 0) {
                player.y = entity.getBottom();
            } else {
                // If the player is approaching from negative Y
                player.y = entity.getTop() - player.height;
            }

            // Velocity component
            player.vy = -player.vy * entity.restitution;
            if (abs(player.vy) < STICKY_THRESHOLD) {
                player.vy = 0;
            }
        }
    }