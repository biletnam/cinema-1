
(function () {


  cinema.utilities.CreateWebGlLutCompositor = function() {

    var gl = 0,
    displayProgram = null,
    compositeProgram = null,
    compositeLutProgram = null,
    backgroundProgram = null,
    texCoordBuffer = 0,
    posCoordBuffer = 0,
    texture = 0,
    lutTexture = 0,
    fbo = 0,
    renderTexture = 0,
    scalarTexture = 0,
    imgw = 500,
    imgh = 500,
    viewportWidth = 0,
    viewportHeight = 0,
    vpCenterX = 0,
    vpCenterY = 0,
    left = 0,
    right = 0,
    bottom = 0,
    top = 0,
    projection = null,
    mvp = null,
    glCanvas = null,
    initialized = false;


    // --------------------------------------------------------------------------
    //
    // --------------------------------------------------------------------------
    function init(imgSize, webglCanvas) {
      if (initialized === true) {
        cleanUpGlState();
      }

      initialized = true;

      imgw = imgSize[0];
      imgh = imgSize[1];
      viewportWidth = webglCanvas.width;
      viewportHeight = webglCanvas.height;
      vpCenterX = viewportWidth / 2.0;
      vpCenterY = viewportHeight / 2.0;
      glCanvas = webglCanvas;

      mvp = mat4.create();
      mat4.identity(mvp);

      projection = mat4.create();
      mat4.identity(projection);

      //Inialize GL context
      initGL();

      // Create a texture object
      createTextures();

      // Create vertex position and tex coord buffers
      initAttribBuffers();

      // Initialize the display program shaders
      displayProgram = createShaderProgram(loadShaderFiles('/shaders/vertex/displayVertex.c', '/shaders/fragment/displayFragment.c'));

      // look up where the vertex position coords need to go when using the display program
      gl.bindBuffer(gl.ARRAY_BUFFER, posCoordBuffer);
      displayProgram.positionLocation = gl.getAttribLocation(displayProgram, "a_position");
      gl.enableVertexAttribArray(displayProgram.positionLocation);
      gl.vertexAttribPointer(displayProgram.positionLocation, 2, gl.FLOAT, false, 0, 0);

      // ditto for vertex texture coords
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
      displayProgram.texCoordLocation = gl.getAttribLocation(displayProgram, "a_texCoord");
      gl.enableVertexAttribArray(displayProgram.texCoordLocation);
      gl.vertexAttribPointer(displayProgram.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

      // Initialize the compositing program shaders
      compositeProgram = createShaderProgram(loadShaderFiles('/shaders/vertex/compositeVertex.c', '/shaders/fragment/compositeFragment.c'));

      // look up where the vertex position coords need to go when using the compositing program
      gl.bindBuffer(gl.ARRAY_BUFFER, posCoordBuffer);
      compositeProgram.positionLocation = gl.getAttribLocation(compositeProgram, "a_position");
      gl.enableVertexAttribArray(compositeProgram.positionLocation);
      gl.vertexAttribPointer(compositeProgram.positionLocation, 2, gl.FLOAT, false, 0, 0);

      // ditto for vertex texture coords
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
      compositeProgram.texCoordLocation = gl.getAttribLocation(compositeProgram, "a_texCoord");
      gl.enableVertexAttribArray(compositeProgram.texCoordLocation);
      gl.vertexAttribPointer(compositeProgram.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

      // Initialize the compositing program shaders
      compositeLutProgram = createShaderProgram(loadShaderFiles('/shaders/vertex/compositeVertex.c', '/shaders/fragment/compositeLutFragment.c'));

      // look up where the vertex position coords need to go when using the compositing program
      gl.bindBuffer(gl.ARRAY_BUFFER, posCoordBuffer);
      compositeLutProgram.positionLocation = gl.getAttribLocation(compositeLutProgram, "a_position");
      gl.enableVertexAttribArray(compositeLutProgram.positionLocation);
      gl.vertexAttribPointer(compositeLutProgram.positionLocation, 2, gl.FLOAT, false, 0, 0);

      // ditto for vertex texture coords
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
      compositeLutProgram.texCoordLocation = gl.getAttribLocation(compositeLutProgram, "a_texCoord");
      gl.enableVertexAttribArray(compositeLutProgram.texCoordLocation);
      gl.vertexAttribPointer(compositeLutProgram.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

      // Initialize the compositing program shaders
      backgroundProgram = createShaderProgram(loadShaderFiles('/shaders/vertex/compositeVertex.c', '/shaders/fragment/backgroundFragment.c'));

      // look up where the vertex position coords need to go when using the compositing program
      gl.bindBuffer(gl.ARRAY_BUFFER, posCoordBuffer);
      backgroundProgram.positionLocation = gl.getAttribLocation(backgroundProgram, "a_position");
      gl.enableVertexAttribArray(backgroundProgram.positionLocation);
      gl.vertexAttribPointer(backgroundProgram.positionLocation, 2, gl.FLOAT, false, 0, 0);

      // ditto for vertex texture coords
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
      backgroundProgram.texCoordLocation = gl.getAttribLocation(backgroundProgram, "a_texCoord");
      gl.enableVertexAttribArray(backgroundProgram.texCoordLocation);
      gl.vertexAttribPointer(backgroundProgram.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

      // Create a framebuffer for rendering to texture
      var fboResult = initFrameBuffer();
      fbo = fboResult[0];
      renderTexture = fboResult[1];
    }


    // --------------------------------------------------------------------------
    //
    // --------------------------------------------------------------------------
    function resizeViewport(newWidth, newHeight) {
      viewportWidth = newWidth;
      viewportHeight = newHeight;
      vpCenterX = viewportWidth / 2.0;
      vpCenterY = viewportHeight / 2.0;
    }


    // --------------------------------------------------------------------------
    //
    // --------------------------------------------------------------------------
    function cleanUpGlState() {
        // Clean up the display program and its shaders
        for (var i = 0; i < displayProgram.shaders.length; i+=1) {
          gl.deleteShader(displayProgram.shaders[i]);
        }
        gl.deleteProgram(displayProgram);

        // Clean up the composite program and its shaders
        for (var j = 0; j < compositeProgram.shaders.length; j+=1) {
          gl.deleteShader(compositeProgram.shaders[j]);
        }
        gl.deleteProgram(compositeProgram);

        // Clean up the composite lut program and its shaders
        for (var k = 0; k < compositeLutProgram.shaders.length; k+=1) {
          gl.deleteShader(compositeLutProgram.shaders[k]);
        }
        gl.deleteProgram(compositeLutProgram);

        // Clean up the background program and its shaders
        for (var l = 0; l < backgroundProgram.shaders.length; l+=1) {
          gl.deleteShader(backgroundProgram.shaders[l]);
        }
        gl.deleteProgram(backgroundProgram);

        // Now clean up fbo, textures, and buffers
        gl.deleteFramebuffer(fbo);
        gl.deleteTexture(renderTexture);
        gl.deleteTexture(texture);
        gl.deleteTexture(lutTexture);
        gl.deleteTexture(scalarTexture);
        gl.deleteBuffer(texCoordBuffer);
        gl.deleteBuffer(posCoordBuffer);
    }


    // --------------------------------------------------------------------------
    //
    // --------------------------------------------------------------------------
    function initGL() {
      // Get A WebGL context
      gl = glCanvas.getContext("experimental-webgl") || glCanvas.getContext("webgl");
      if (!gl) {
        return null;
      }
      // Set clear color to white, fully transparent
      gl.clearColor(1.0, 1.0, 1.0, 0.0);

      var vertexUnits = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
      var fragmentUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
      var combinedUnits = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);

      //console.log("vertex texture image units: " + vertexUnits);
      //console.log("fragment texture image units: " + fragmentUnits);
      //console.log("combined texture image units: " + combinedUnits);
    }

    // --------------------------------------------------------------------------
    //
    //
    // --------------------------------------------------------------------------
    function initShader( src, type ) {
      var shader = gl.createShader( type );

      gl.shaderSource( shader, src );

      // Compile and check status
      gl.compileShader( shader );
      var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
      if (!compiled)
      {
        // Something went wrong during compilation; get the error
        var lastError = gl.getShaderInfoLog(shader);
        console.error( "Error compiling shader '" + shader + "':" + lastError );
        gl.deleteShader( shader );

        return null;
      }

      return shader;
    }

    // --------------------------------------------------------------------------
    //
    //
    // --------------------------------------------------------------------------
    function createShaderProgram( shaders ) {
      var program = gl.createProgram();

      for(var i = 0; i < shaders.length; i+=1) {
        gl.attachShader( program, shaders[ i ] );
      }

      gl.linkProgram( program );

      // Check the link status
      var linked = gl.getProgramParameter(program, gl.LINK_STATUS);
      if (!linked) {
        // something went wrong with the link
        var lastError = gl.getProgramInfoLog (program);
        console.error("Error in program linking:" + lastError);
        gl.deleteProgram(program);

        return null;
      }

      program.shaders = shaders;
      gl.useProgram(program);

      return program;
    }


    // --------------------------------------------------------------------------
    //
    // --------------------------------------------------------------------------
    function loadShaderFiles(vertexUrl, fragmentUrl) {

      function loadFile(url) {
        var xhr = new XMLHttpRequest();
        var okStatus = document.location.protocol === "file:" ? 0 : 200;
        xhr.open('GET', url, false);
        xhr.send(null);
        return xhr.status === okStatus ? xhr.responseText : null;
      }

      var vertexShader = initShader(loadFile(vertexUrl), gl.VERTEX_SHADER);
      var fragmentShader = initShader(loadFile(fragmentUrl), gl.FRAGMENT_SHADER);

      return [ vertexShader, fragmentShader ];
    }


    // --------------------------------------------------------------------------
    //
    // --------------------------------------------------------------------------
    function initAttribBuffers() {
      // Create buffer for vertex texture coordinates
      texCoordBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0.0,  0.0,
        1.0,  0.0,
        0.0,  1.0,
        0.0,  1.0,
        1.0,  0.0,
        1.0,  1.0]), gl.STATIC_DRAW);

      // Create a buffer for the vertex positions
      posCoordBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posCoordBuffer);
      var x1 = -1;
      var x2 = 1;
      var y1 = -1;
      var y2 = 1;
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        x1, y1,
        x2, y1,
        x1, y2,
        x1, y2,
        x2, y1,
        x2, y2]), gl.STATIC_DRAW);
    }


    // --------------------------------------------------------------------------
    //
    // --------------------------------------------------------------------------
    function initFrameBuffer() {
          // Create and bind a framebuffer
          var fbo = gl.createFramebuffer();
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
          fbo.width = imgw;
          fbo.height = imgh;

          // Need a texture we can bind after rendering to the fbo
          var rTex = gl.createTexture();

          gl.bindTexture(gl.TEXTURE_2D, rTex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

          // Calling with null image data means we intend to render to this texture
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fbo.width, fbo.height,
                        0, gl.RGBA, gl.UNSIGNED_BYTE, null);

          // Attach the color buffer to fbo
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                                  gl.TEXTURE_2D, rTex, 0);

          // Check fbo status
          var fbs = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
          if (fbs !== gl.FRAMEBUFFER_COMPLETE) {
            console.log("ERROR: There is a problem with the framebuffer: " + fbs);
          }

          // Clear the bindings we created in this function.
          gl.bindTexture(gl.TEXTURE_2D, null);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);

          return [fbo, rTex];
    }


    // --------------------------------------------------------------------------
    //
    // --------------------------------------------------------------------------
    function createTextures() {
      // Create a texture.
      texture = gl.createTexture();

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      // Set the parameters so we can render any size image.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      // Create another texture for the scalar image data
      scalarTexture = gl.createTexture();

      gl.bindTexture(gl.TEXTURE_2D, scalarTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      // Set the parameters so we can render any size image.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      // Create one more texture for the lookup table
      lutTexture = gl.createTexture();

      gl.bindTexture(gl.TEXTURE_2D, lutTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      // Set the parameters so we can render any size image.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      gl.bindTexture(gl.TEXTURE_2D, null);
    }


    // --------------------------------------------------------------------------
    //
    // --------------------------------------------------------------------------
    function calculateProjectionMatrix(matrix, xscale, yscale, center) {
      // Relate the center of the current viewport to the center of clip space
      var centerX = ((vpCenterX - center[0]) / vpCenterX) * xscale;
      var centerY = ((center[1] - vpCenterY) / vpCenterY) * yscale;

      left = centerX - xscale;
      right = centerX + xscale;
      bottom = centerY - yscale;
      top = centerY + yscale;

      mat4.ortho(matrix, left, right, bottom, top, 1.0, -1.0);
    }


    // --------------------------------------------------------------------------
    //
    // --------------------------------------------------------------------------
    function drawDisplayPass(xscale, yscale, center) {
      // Draw to the screen framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      // Using the display shader program
      gl.useProgram(displayProgram);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.viewport(0, 0, viewportWidth, viewportHeight);

      // Set up the sampler uniform and bind the rendered texture
      var u_image = gl.getUniformLocation(displayProgram, "u_image");
      gl.uniform1i(u_image, 0);
      gl.activeTexture(gl.TEXTURE0 + 0);
      gl.bindTexture(gl.TEXTURE_2D, renderTexture);

      // Get a projection matrix to draw the final image at the correct scale and location
      calculateProjectionMatrix(projection, xscale, yscale, center);
      var mvpLoc = gl.getUniformLocation(displayProgram, "mvp");
      gl.uniformMatrix4fv(mvpLoc, false, projection);

      // Draw the rectangle.
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.finish();

      // Now unbind the textures we used
      for (var i = 0; i < 1; i+=1) {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
    }


    // --------------------------------------------------------------------------
    //
    // --------------------------------------------------------------------------
    function drawCompositePass(textureCanvas) {
      // Draw to the fbo on this pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

      // Using the compositing shader program
      gl.useProgram(compositeProgram);

      //gl.clear(gl.COLOR_BUFFER_BIT);
      gl.viewport(0, 0, imgw, imgh);

      // Set up the layer texture
      var layer = gl.getUniformLocation(compositeProgram, "layerSampler");
      gl.uniform1i(layer, 0);
      gl.activeTexture(gl.TEXTURE0 + 0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,  gl.RGBA, gl.UNSIGNED_BYTE, textureCanvas);

      // Set up the sampler uniform and bind the rendered texture
      var composite = gl.getUniformLocation(compositeProgram, "compositeSampler");
      gl.uniform1i(composite, 1);
      gl.activeTexture(gl.TEXTURE0 + 1);
      gl.bindTexture(gl.TEXTURE_2D, renderTexture);

      // Draw the rectangle.
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.finish();

      // Now unbind the textures we used
      for (var i = 0; i < 2; i+=1) {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
    }


    // --------------------------------------------------------------------------
    //
    // --------------------------------------------------------------------------
    function drawBackgroundPass(backgroundCanvas, backgroundColor) {
      // Draw to the fbo on this pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

      // Using the background shader program
      gl.useProgram(backgroundProgram);

      //gl.clear(gl.COLOR_BUFFER_BIT);
      gl.viewport(0, 0, imgw, imgh);

      var bgColor = vec4.fromValues(backgroundColor[0], backgroundColor[1], backgroundColor[2], 1.0);
      var bgc = gl.getUniformLocation(backgroundProgram, "backgroundColor");
      gl.uniform4fv(bgc, bgColor);

      // Set up the layer texture
      var layer = gl.getUniformLocation(backgroundProgram, "backgroundSampler");
      gl.uniform1i(layer, 0);
      gl.activeTexture(gl.TEXTURE0 + 0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, backgroundCanvas);

      // Draw the rectangle.
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.finish();

      // Now unbind the textures we used
      for (var i = 0; i < 1; i+=1) {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
    }


    // --------------------------------------------------------------------------
    //
    // --------------------------------------------------------------------------
    function drawLutCompositePass(scalarCanvas, lutData) {
      // Draw to the fbo on this pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

      // Using the lut compositing shader program
      gl.useProgram(compositeLutProgram);

      gl.viewport(0, 0, imgw, imgh);

      // Set up the scalar texture
      var scalar = gl.getUniformLocation(compositeLutProgram, "scalarSampler");
      gl.uniform1i(scalar, 0);
      gl.activeTexture(gl.TEXTURE0 + 0);
      gl.bindTexture(gl.TEXTURE_2D, scalarTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,  gl.RGBA, gl.UNSIGNED_BYTE, scalarCanvas);

      // Set up the sampler uniform and bind the rendered texture
      var composite = gl.getUniformLocation(compositeLutProgram, "compositeSampler");
      gl.uniform1i(composite, 1);
      gl.activeTexture(gl.TEXTURE0 + 1);
      gl.bindTexture(gl.TEXTURE_2D, renderTexture);

      // Set up the lookup table texture
      var lut = gl.getUniformLocation(compositeLutProgram, "lutSampler");
      gl.uniform1i(lut, 2);
      gl.activeTexture(gl.TEXTURE0 + 2);
      gl.bindTexture(gl.TEXTURE_2D, lutTexture);
      gl.texImage2D (gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lutData);

      // Draw the rectangle.
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.finish();

      // Now unbind the textures we used
      for (var i = 0; i < 3; i+=1) {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
    }


    // --------------------------------------------------------------------------
    //
    // --------------------------------------------------------------------------
    function clearFbo() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }


    return {
      'init': init,
      'clearFbo': clearFbo,
      'drawBackgroundPass': drawBackgroundPass,
      'drawCompositePass': drawCompositePass,
      'drawLutCompositePass': drawLutCompositePass,
      'drawDisplayPass': drawDisplayPass,
      'resizeViewport': resizeViewport
    };

  };
}) ();