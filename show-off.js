var DEG2RAD = Math.PI/360;

function draw_shape(off_file, canvas_id, cam_dist) {
	 var ogl = new Shape(off_file, canvas_id, cam_dist);
}

var scene = {
	/* ambient light */
	'light_ambient_r': 0.4,
	'light_ambient_g': 0.4,
	'light_ambient_b': 0.4,

	/* directional light (will be normalized `*/
	'light_dir_1': [-.2, -.2, -1],
	'light_dir_1_r': 0.6,
	'light_dir_1_g': 0.6,
	'light_dir_1_b': 0.6,
};

var frag_shader = `
	precision mediump float;

	varying vec4 v_col;
	varying vec3 v_light_weight;

	void main(void) {
		gl_FragColor = vec4(v_light_weight * v_col.rgb, v_col.a);
	}
`;

var vert_shader = `
	attribute vec3 v_pos_attr;
	attribute vec3 norms_attr;
	attribute vec4 v_col_attr;

	uniform mat4 pos_mat;
	uniform mat4 proj_mat;
	uniform mat3 norm_mat;

	uniform vec3 lgt_ambient_col;
	uniform vec3 lgt_dir_1;
	uniform vec3 lgt_dir_1_col;

	varying vec4 v_col;
	varying vec3 v_light_weight;

	void main(void) {
		gl_Position = proj_mat * pos_mat * vec4(v_pos_attr, 1.0);
		v_col = v_col_attr;
		vec3 norm = norm_mat * norms_attr;
		float w_lgt_dir_1 = max(dot(norm, lgt_dir_1), 0.0);
		v_light_weight = lgt_ambient_col + lgt_dir_1_col * w_lgt_dir_1;
	}
`;

function triangle_normal(n, v0, v1, v2) {
	var d1 = vec3.create();
	var d2 = vec3.create();
	vec3.subtract(d1, v1, v0);
	vec3.subtract(d2, v2, v0);
	vec3.cross(n, d1, d2);
	vec3.normalize(n, n);
	/* Let the normal always point out */
	if (vec3.len(vec3.add(d1, v0, n)) < vec3.len(v0)) {
		vec3.negate(n, n);
	}
	return n;
}

function create_gl_context(id) {
	var canvas = document.getElementById(id);

	var ctx = canvas.getContext("webgl");
	ctx.viewport_width = canvas.width;
	ctx.viewport_height = canvas.height;
	return ctx;
}

function Shape(off_file, canvas_id, cam_dist) {
	/* Retrieve the specified off-file, interpret the file and draw it on
	 * the canvas with the name 'canvas_id'.
	 *
	 * off_file: the file in .off format that specifies the shape
	 * canvas_id: the name of the canvas to draw on
	 * cam_dist: the distance of the camera
	 */
	this.off_file = off_file;
	this.gl = create_gl_context(canvas_id);
	this.gl.my = {};
	this.angle = 0;
	this.before = 0;
	var this_ = this; // define var the reach inside call-back
	$.get(off_file, function(data) {
		this_.get_off_shape(data);
		this_.gl_init(cam_dist);
		this_.gl.my.shader_prog = this_.get_shader_prog();
		this_.triangulate();
		this_.animate();
	});
}

Shape.prototype.get_off_shape = function(data) {
	states = {
		'checkOff': 0,
		'readSizes': 1,
		'readVs': 2,
		'readFs': 3,
		'readOk': 4
	};
	var nrRead = 0;
	var state = states.checkOff;
	var lines = data.split('\n');
	var error = false
	for (var i = 0; i < lines.length; i++) {
		if (!lines[i].match(/\s*(#)/) && lines[i] != "") {
			var words = lines[i].match(/\s*(\S+)/g)
			switch (state) {
			case states.checkOff:
				error = words[0] != 'OFF';
				if (!error) {
					state = states.readSizes;
					console.log('OFF file format recognised')
				} else {
					console.error("file should start with keyword 'OFF'");
				}
				break;
			case states.readSizes:
				var nrOfVs = parseInt(words[0]);
				var nrOfFs = parseInt(words[1]);
				var nrOfEs = parseInt(words[2]);
				this.Vs = new Array(nrOfVs);
				this.Fs = new Array(nrOfFs);
				this.Es = [];
				this.cols = new Array(nrOfFs);
				console.log('will read', nrOfVs, 'Vs', nrOfFs, 'Fs (', nrOfEs, 'edges)');
				state = states.readVs;
				break;
			case states.readVs:
				error = words.length < 3;
				if (!error) {
					this.Vs[nrRead] = [
						parseFloat(words[0]),
						parseFloat(words[1]),
						parseFloat(words[2])];
					console.log(this.Vs[nrRead]);
					nrRead += 1;
					if (nrRead >= this.Vs.length) {
						console.log('read Vs done');
						state = states.readFs;
						nrRead = 0;
					}
				} else {
					console.error('error reading vertex', nrRead);
				}
				break;
			case states.readFs:
				var n = parseInt(words[0]);
				error = (words.length != n + 1) && (
					words.length != n + 4);
				if (!error) {
					var face = new Array(n);
					for (var j = 0; j < n; j++) {
						face[j] = parseInt(words[j+1]);
					}
					if (n >= 3) {
						this.Fs[nrRead] = face;
					} else if (n == 2) {
						this.Es.push(face);
					} // else ignore, but count
					var col = new Array(3);
					if (words.length == n + 1) {
						col = [0.8, 0.8, 0.8];
					} else {
						for (var j = 0; j < 3; j++) {
							ch = parseFloat(words[n+1+j]);
							if (ch < 1) {
								col[j] = ch;
							} else {
								col[j] = ch / 255;
							}
						}
					}
					// add alpha = 1
					col.push(1);
					this.cols[nrRead] = col;
					console.log('face', face, 'col', col);
					nrRead += 1;
					console.log(nrRead, this.Fs.length);
					if (nrRead >= this.Fs.length) {
						state = states.readOk;
						console.log('Done reading OFF file');
						nrRead = 0;
					}
				} else {
					console.error('error reading face', nrRead);
					console.log(words.length, '!=', n+1, 'or', n+4);
				}
				break;
			}
			if (error) {
				break;
			}
		}
	}
	if (state != states.readOk) {
		throw 'Error reading OFF file';
	}
}

Shape.prototype.gl_init = function(cam_dist) {
	var gl = this.gl;
	gl.my.proj_mat = mat4.create();
	gl.my.pos_mat = mat4.create();
	gl.my.pos_mat_stack = [];
	gl.my.cam_dist = cam_dist;

	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.enable(gl.DEPTH_TEST);
}

Shape.prototype.compile_shader = function(shader, prog) {
	var gl = this.gl;
	gl.shaderSource(shader, prog);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw prog + ":\n" + gl.getShaderInfoLog(shader);
	}
}

Shape.prototype.compile_f_shader = function(prog) {
	var shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
	this.compile_shader(shader, prog);
	return shader;
}

Shape.prototype.compile_v_shader = function(prog) {
	var shader = this.gl.createShader(this.gl.VERTEX_SHADER);
	this.compile_shader(shader, prog);
	return shader;
}

Shape.prototype.get_shader_prog = function() {
	var gl = this.gl;

	var f_shader = this.compile_f_shader(frag_shader);
	var v_shader = this.compile_v_shader(vert_shader);

	shader_prog = gl.createProgram();
	gl.attachShader(shader_prog, v_shader);
	gl.attachShader(shader_prog, f_shader);
	gl.linkProgram(shader_prog);

	if (!gl.getProgramParameter(shader_prog, gl.LINK_STATUS)) {
		throw "Error initialising shaders";
	}

	gl.useProgram(shader_prog);

	shader_prog.v_pos_attr = gl.getAttribLocation(shader_prog, "v_pos_attr");
	gl.enableVertexAttribArray(shader_prog.v_pos_attr);

	shader_prog.norms_attr = gl.getAttribLocation(shader_prog, "norms_attr");
	gl.enableVertexAttribArray(shader_prog.norms_attr);

	shader_prog.v_col_attr = gl.getAttribLocation(shader_prog, "v_col_attr");
	gl.enableVertexAttribArray(shader_prog.v_col_attr);

	shader_prog.proj_mat = gl.getUniformLocation(shader_prog, "proj_mat");
	shader_prog.pos_mat = gl.getUniformLocation(shader_prog, "pos_mat");
	shader_prog.norm_mat = gl.getUniformLocation(shader_prog, "norm_mat");

	shader_prog.lgt_ambient_col = gl.getUniformLocation(shader_prog,
							"lgt_ambient_col");
        shader_prog.lgt_dir_1 = gl.getUniformLocation(shader_prog,
							"lgt_dir_1");
        shader_prog.lgt_dir_1_col = gl.getUniformLocation(shader_prog,
							"lgt_dir_1_col");

	return shader_prog;
}

Shape.prototype.triangulate = function() {
	/*
	 * Divide all the faces in this.Fs, this.Vs and this.cols into
	 * triangles and save in the result in this.gl.my.vs, this.gl.my.v_cols,
	 * and this.gl.my.fs.
	 *
	 * this: should contain:
	 *        - Vs: array of vertices, each element is a 3 dimensional array
	 *          of floats.
	 *        - Fs: array of faces. Each face consists of indices of Vs in a
	 *          counter-clockwise order.
	 *        - cols: array of face colors. The index in cols defines that
	 *          the face with the same index in Fs has the specified colour.
	 *          Each colour is an array of RGB values 0 <= colour <= 1.
	 * Result:
	 *        this.gl.my.vs: an OpenGL vertex buffer object with the fields
	 *            elem_len and no_of_elem. The latter expresses the amount
	 *            of vertices, the former the length per vertex.
	 *        this.gl.my.v_cols: an OpenGL vertex colour buffer object with
	 *            the fields elem_len and no_of_elem. The latter expresses
	 *            the amount of vertices, the former the length per vertex.
	 *            Numitems should be equal to this.gl.my.vs.no_of_elem
	 *        this.gl.my.ns: an OpenGL normals buffer object with the fields
	 *            elem_len and no_of_elem that specifies the normal to be
	 *            used for that vertex.
	 *        this.gl.my.fs: an OpenGL face buffer object with the fields
	 *            elem_len  and no_of_elem. The latter expresses the amount
	 *            of face indices, the former the length per index (i.e. 1).
	 *            Each triplet forms a triangle.
	 */
	var fs = [];
	var vs = [];
	var ns = [];
	var cols = [];
	var no_vs = 0;
	for (var j = 0; j < this.Fs.length; j++) {
		var f = this.Fs[j];
		var n = vec3.create();
		triangle_normal(n,
			this.Vs[f[0]], this.Vs[f[1]], this.Vs[f[2]]);
		for (var i = 0; i < f.length; i++) {
			vs = vs.concat(this.Vs[f[i]]);
			cols = cols.concat(this.cols[j]);
			/* convert to std Array, otherwise concat doesn't work */
			ns = ns.concat(Array.prototype.slice.call(n));
		}
		var tris_1_face = [];
		for (var i = 1; i < f.length - 1; i++) {
			// i+1 before i, to keep clock-wise direction
			tris_1_face = tris_1_face.concat([no_vs, no_vs + i + 1, no_vs + i]);
		}
		no_vs += f.length;
		fs = fs.concat(tris_1_face);
	}
	var gl = this.gl

	gl.my.vs = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.vs);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vs), gl.STATIC_DRAW);
	gl.my.vs.elem_len = 3;
	gl.my.vs.no_of_elem = no_vs;

	gl.my.v_cols = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.v_cols);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cols), gl.STATIC_DRAW);
	gl.my.v_cols.elem_len = 4;
	gl.my.v_cols.no_of_elem = no_vs;

	gl.my.ns = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.ns);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ns), gl.STATIC_DRAW);
	gl.my.ns.elem_len = 3;
	gl.my.ns.no_of_elem = no_vs;

	gl.my.fs = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.my.fs);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(fs), gl.STATIC_DRAW);
	gl.my.fs.elem_len = 1;
	gl.my.fs.no_of_elem = fs.length;
}

Shape.prototype.pos_mat_push = function() {
	var cp = mat4.create();
	mat4.copy(cp, this.gl.my.pos_mat);
	this.gl.my.pos_mat_stack.push(cp);
}

Shape.prototype.pos_mat_pop = function() {
	if (this.gl.my.pos_mat.length == 0) {
		throw "cannot pop pos matrix: stack empty!";
        }
	this.gl.my.pos_mat = this.gl.my.pos_mat_stack.pop();
}

Shape.prototype.draw = function() {
	var gl = this.gl;

	gl.viewport(0, 0, gl.viewport_width, gl.viewport_height);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	/* TODO: get max R value and add to cam_dist (+ some margin) */
	mat4.perspective(gl.my.proj_mat,
		45.0, gl.viewport_width / gl.viewport_height, 0.1, 4*gl.my.cam_dist);

	mat4.identity(gl.my.pos_mat);
	mat4.translate(gl.my.pos_mat, gl.my.pos_mat, [0.0, 0.0, -gl.my.cam_dist]);

	this.pos_mat_push();
	/* TODO: get angle and speed from HTML file */
	mat4.rotate(gl.my.pos_mat, gl.my.pos_mat, this.angle*DEG2RAD, [0.25, 1, 0]);

	gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.vs);
	gl.vertexAttribPointer(gl.my.shader_prog.v_pos_attr,
		gl.my.vs.elem_len, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.ns);
	gl.vertexAttribPointer(gl.my.shader_prog.norms_attr,
		gl.my.ns.elem_len, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.v_cols);
	gl.vertexAttribPointer(gl.my.shader_prog.v_col_attr,
		gl.my.v_cols.elem_len, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.my.fs);

	gl.uniformMatrix4fv(gl.my.shader_prog.proj_mat, false, gl.my.proj_mat);
	gl.uniformMatrix4fv(gl.my.shader_prog.pos_mat, false, gl.my.pos_mat);

	var norm_mat = mat3.create();
	mat3.normalFromMat4(norm_mat, gl.my.pos_mat);
	gl.uniformMatrix3fv(gl.my.shader_prog.norm_mat, false, norm_mat);

	gl.uniform3f(gl.my.shader_prog.lgt_ambient_col,
		 scene['light_ambient_r'],
		 scene['light_ambient_g'],
		 scene['light_ambient_b']);
	var light_dir_1 = vec3.create();
	vec3.normalize(light_dir_1, scene['light_dir_1']);
	/* incoming light -> source of light */
	vec3.scale(light_dir_1, light_dir_1, -1);
	gl.uniform3fv(gl.my.shader_prog.lgt_dir_1, light_dir_1);
	gl.uniform3f(
		gl.my.shader_prog.lgt_dir_1_col,
		scene['light_dir_1_r'],
		scene['light_dir_1_g'],
		scene['light_dir_1_b']);

	gl.drawElements(gl.TRIANGLES, gl.my.fs.no_of_elem, gl.UNSIGNED_SHORT, 0);

	this.pos_mat_pop();
}

Shape.prototype.rotate = function() {
	var now = new Date().getTime();
	if (this.before != 0) {
		var diff = now - this.before;

		this.angle += (60 * diff) / 1000.0;
	}
	this.before = now;
}

Shape.prototype.animate = function() {
	requestAnimFrame(() => this.animate());
	this.rotate();
	this.draw();
}

// vim: set noexpandtab sw=8