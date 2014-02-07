var physicsDemo = {};  // namespace
physicsDemo.settings = {
	imgPath    : 'img/bird.png',
	fps        : 30,
	frequency  : 4,
	maxObjects : 35,
	width	   : 600,
	height     : 400
};

// DEMO //////////////
// this handles everything outside of b2d including easeljs functionality and visuals

physicsDemo.demo = (function(){
	var debug = false,
		birdDelayCounter = 0;

	// INIT //////////////
	// setup the basic vars, stage, canvas, etc

	var init = function() {
		var that = this;
		stage = new createjs.Stage('demoCanvas');
		stage.snapPixelsEnabled = true;

		// setup the easeljs ticker (animation frame rate)
		createjs.Ticker.setFPS(physicsDemo.settings.fps);
		createjs.Ticker.useRAF = true;
		createjs.Ticker.addEventListener('tick', function(){ that.tick(); });

		// init box2d world
		physicsDemo.b2d.init();
	};

	// BIRD /////////////
	// creates an easeljs bitmap bird instance

	var bird = function() {
		var birdBMP          = new createjs.Bitmap(physicsDemo.settings.imgPath);
		birdBMP.x            = Math.round(Math.random()*physicsDemo.settings.width);
		birdBMP.y            = -30;
		birdBMP.snapToPixel  = true;
		birdBMP.mouseEnabled = false;
		birdBMP.regX = birdBMP.regY = 25;   // it's important to set origin point to center of your bitmap
		stage.addChild(birdBMP);
		return birdBMP;
	};

	// TICK ///////////////
	// this is the framerate of the app, this is called many times per second, so it should be doing as little as possible

	var tick = function() {
		// update the physics simulation and objects in easel stage
		physicsDemo.b2d.tick();
		stage.update();

		// spawn another bird every so often
		birdDelayCounter++;
		if(birdDelayCounter % physicsDemo.settings.frequency === 0) {  // delay so it doesn't spawn a bird on every frame (that would just be bananas)
			birdDelayCounter = 0;
			var bird = this.bird();
			physicsDemo.b2d.createCircle({actor: bird});
		}
	};

	// DOM ///////////////
	// this handles all DOM manipulation, primarilly the hide/show of the debug window and canvas sizing

	var dom = (function() {
		var $debugToggle = $('#debugToggle'),
			$debugCanvas = $('#debugCanvas'),
			$canvases    = $('canvas');
		var debugToggle = function() {
			if(debug) { $debugCanvas.removeClass('show'); debug = false; }
			else { $debugCanvas.addClass('show'); debug = true; }
		};
		$debugToggle.on('click', debugToggle);
		$canvases.each(function(){
			$(this).attr({'width': physicsDemo.settings.width, 'height': physicsDemo.settings.height});
		});
	})();

	return {
		init: init,
		tick: tick,
		bird: bird,
		debug: function() { return debug; },
		stage: function() { return stage; }
	};
})();

// B2D //////////////
/*
This handles everything on the box2d physics side of things.
The box2d syntax is quite long form, when building something with it
I reccomend creating helper functions for things like boxes, circles, etc
for this demo, however, I'm just keeping it simple and writing it all out
*/

physicsDemo.b2d = (function(){
	// important box2d scale and speed vars
	var SCALE = 30, STEP = 20, TIMESTEP = 1/STEP;

	// common variables used for box2d
	var world,
		lastTimestamp = Date.now(),
		fixedTimestepAccumulator = 0,
		bodiesToRemove = [],
		actors = [],
		bodies = [];

	// Shorthand variables for common box2d functions used in the demo
	var b2 = {
		vec2		   : Box2D.Common.Math.b2Vec2,
		bodyDef	       : Box2D.Dynamics.b2BodyDef,
		body 		   : Box2D.Dynamics.b2Body,
		fixtureDef     : Box2D.Dynamics.b2FixtureDef,
		fixture 	   : Box2D.Dynamics.b2Fixture,
		world		   : Box2D.Dynamics.b2World,
		polygonShape   : Box2D.Collision.Shapes.b2PolygonShape,
		circleShape    : Box2D.Collision.Shapes.b2CircleShape,
		debugDraw      : Box2D.Dynamics.b2DebugDraw
	};

	// INIT //////////////
	// setup the b2d world and edge boundaries for objects

	var init = function() {
		// setup the world and all boundaries
		world = new b2.world(new b2.vec2(0,10), true);
		addDebug();
		// boundaries - floor
		var floorFixture = new b2.fixtureDef;
		floorFixture.density = floorFixture.restitution = 0.7;
		floorFixture.shape = new b2.polygonShape;
		floorFixture.shape.SetAsBox((physicsDemo.settings.width + 50) / SCALE, 10 / SCALE);
		var floorBodyDef = new b2.bodyDef;
		floorBodyDef.type = b2.body.b2_staticBody;
		floorBodyDef.position.x = -25 / SCALE;
		floorBodyDef.position.y = (physicsDemo.settings.height + 10) / SCALE;
		var floor = world.CreateBody(floorBodyDef);
		floor.CreateFixture(floorFixture);
		// boundaries - left
		var leftFixture = new b2.fixtureDef;
		leftFixture.shape = new b2.polygonShape;
		leftFixture.shape.SetAsBox(10 / SCALE, (physicsDemo.settings.height + 50) / SCALE);
		var leftBodyDef = new b2.bodyDef;
		leftBodyDef.type = b2.body.b2_staticBody;
		leftBodyDef.position.x = -10 / SCALE;
		leftBodyDef.position.y = -25 / SCALE;
		var left = world.CreateBody(leftBodyDef);
		left.CreateFixture(leftFixture);
		// boundaries - right
		var rightFixture = new b2.fixtureDef;
		rightFixture.shape = new b2.polygonShape;
		rightFixture.shape.SetAsBox(10 / SCALE, (physicsDemo.settings.height + 50) / SCALE);
		var rightBodyDef = new b2.bodyDef;
		rightBodyDef.type = b2.body.b2_staticBody;
		rightBodyDef.position.x = (physicsDemo.settings.width + 10) / SCALE;
		rightBodyDef.position.y = -25 / SCALE;
		var right = world.CreateBody(rightBodyDef);
		right.CreateFixture(rightFixture);
	};

	// CREATE /////////////
	// module for creating different b2d shapes with the option of attaching an actor (a bitmap to follow the physics object around)

	var createCircle = function(options) {
		var circleFixture = new b2.fixtureDef;
		circleFixture.density = 1;
		circleFixture.restitution = 0.1;
		circleFixture.shape = new b2.circleShape(24 / SCALE);
		var circleBodyDef = new b2.bodyDef;
		circleBodyDef.type = b2.body.b2_dynamicBody;
		if(options && options.actor) {
			circleBodyDef.position.x = options.actor.x / SCALE;
			circleBodyDef.position.y = options.actor.y / SCALE;
		}
		var circle = world.CreateBody(circleBodyDef);
		circle.CreateFixture(circleFixture);

		// assign actor
		if(options && options.actor) {
			var actor = new this.actor(circle, options.actor);
			actors.push(actor);
			circle.SetUserData(actor);  // set the actor as user data of the body so we can use it later: body.GetUserData()
		}
		bodies.push(circle);
	};

	// ACTOR //////////////
	// This attaches a bitmap (or any object of your choice) to the b2d physics object.

	var actor = function(body, actor) {
		this.body = body;
		this.actor = actor;
		this.tick = function() {  // translate box2d positions to pixels
			this.actor.rotation = this.body.GetAngle() * (57.295);  // 180 / PI
			this.actor.x = this.body.GetWorldCenter().x * SCALE;
			this.actor.y = this.body.GetWorldCenter().y * SCALE;
		};
		this.remove = function() {
			physicsDemo.demo.stage().removeChild(actor);
			actors.splice(actors.indexOf(this), 1);
		};
		return this;
	};

	// TICK /////////////
	// Box2d update function. This is called many times per second from the easeljs ticker, so it's best to keep as simple as possible.
	// The tricky thing to note here is that delta time is used to avoid inconsistencies in simulation if frame rate drops in easeljs

	var tick = function() {
		var now = Date.now(),
			dt  = now - lastTimestamp;
		fixedTimestepAccumulator += dt;
		lastTimestamp = now;
		while(fixedTimestepAccumulator >= STEP) {
			// update all active actors
			for(var i=0, l=actors.length; i<l; i++) { actors[i].tick(); }

			// remove bodies before world timestep
			for(var i=0, l=bodiesToRemove.length; i<l; i++) {
				bodiesToRemove[i].GetUserData().remove();
				bodiesToRemove[i].SetUserData(null);
				world.DestroyBody(bodiesToRemove[i]);
			}
			bodiesToRemove = [];

			world.Step(TIMESTEP, 10, 10);

			fixedTimestepAccumulator -= STEP;
			world.ClearForces();
			if(physicsDemo.demo.debug()) {
	   			world.m_debugDraw.m_sprite.graphics.clear();
	   			world.DrawDebugData();
	   		}
	   		if(bodies.length > physicsDemo.settings.maxObjects) {
	   			bodiesToRemove.push(bodies[0]);
	   			bodies.splice(0,1);
	   		}
		}
	};

	// DEBUGGER ////////////
	// renders shapes of the physics objects so we can see what's going on under the hood

	var addDebug = function() {
		var debugContext = document.getElementById('debugCanvas').getContext('2d'),
			debugDraw    = new b2.debugDraw();
		debugDraw.SetSprite(debugContext);
		debugDraw.SetDrawScale(SCALE);
		debugDraw.SetFillAlpha(0.7);
		debugDraw.SetLineThickness(1.0);
		debugDraw.SetFlags(b2.debugDraw.e_shapeBit | b2.debugDraw.e_jointBit);
		world.SetDebugDraw(debugDraw);
	};

	// public objects other parts of the demo can use
	return {
		init: init,
		tick: tick,
		createCircle: createCircle,
		actor: actor
	};
})();

// start the demo
physicsDemo.demo.init();