function create_gl_context(id) {
	var canvas = document.getElementById(id);
	ctx = canvas.getContext("webgl");
	ctx.viewport_width = canvas.width;
	ctx.viewport_height = canvas.height;
	return ctx;
}

function Shape(off_file, id) {
	/* Retrieve the specified off-file, interpret the file and draw it on
	 * the canvas with the name 'id'.
	 */
	this.off_file = off_file;
	this.gl = create_gl_context(id);
	var this_ = this; // define var the reach inside call-back
	$.get(off_file, function(data) {
		this_.get_off_shape(data);
		this_.triangulate();
		this_.draw(this_);
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

Shape.prototype.triangulate = function() {
	/*
	 * Divide all the faces in this.Fs, this.Vs and this.cols into
	 * triangles and save in the result in this.gl_vs, this.gl_v_cols, and
	 * this.gl_fs.
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
	 *        this.gl_vs: an OpenGL vertex buffer object with the fields
	 *                     itemSize  and numItems. The latter expresses the
	 *                     amount of vertices, the former the length per
	 *                     vertex.
	 *        this.gl_vcols: an OpenGL vertex colour buffer object with the
	 *                        fields itemSize  and numItems. The latter
	 *                        expresses the amount of vertices, the former
	 *                        the length per vertex. Numitems should be
	 *                        equal to this.gl_vs.numItems
	 *        this.gl_fs: an OpenGL face buffer object with the fields
	 *                     itemSize  and numItems. The latter expresses the
	 *                     amount of face indices, the former the length per
	 *                     index (i.e. 1). Each triplet forms a triangle.
	 */
	var fs = [];
	var vs = [];
	var cols = [];
	var no_vs = 0;
	for (var n = 0; n < this.Fs.length; n++) {
		var f = this.Fs[n];
		// add colour and vertices per face (as 1 dimensional list):
		for (var i = 0; i < f.length; i++) {
			vs = vs.concat(this.Vs[f[i]]);
			cols = cols.concat(this.cols[n]);
		}
		var tris_1_face = [];
		for (var i = 1; i < f.length - 1; i++) {
			// i+1 before i, to keep clock-wise direction
			tris_1_face = tris_1_face.concat([no_vs, no_vs + i + 1, no_vs + i]);
		}
		no_vs += f.length;
		fs = fs.concat(tris_1_face);
		console.log('triangulate face', n, tris_1_face);
	}
	var gl = this.gl
	var gl_vs = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, gl_vs);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vs), gl.STATIC_DRAW);
	gl_vs.itemSize = 3;
	gl_vs.numItems = no_vs;
	this.gl_vs = gl_vs;

	var gl_v_cols = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, gl_v_cols);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cols), gl.STATIC_DRAW);
	gl_v_cols.itemSize = 4;
	gl_v_cols.numItems = no_vs;
	this.gl_v_cols = gl_v_cols;

	var gl_fs = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl_fs);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(fs), gl.STATIC_DRAW);
	gl_fs.itemSize = 1;
	gl_fs.numItems = fs.length;
	this.gl_fs = gl_fs;
}

Shape.prototype.draw = function() {
	console.log('Draw function for', this.off_file);
}

// vim: set noexpandtab sw=8
