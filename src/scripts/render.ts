/* eslint-disable @typescript-eslint/no-explicit-any */

// ********************
// Renderer configuration and initiation.
// ********************
import {prepareRender, drawCommands, cameras, controls, entitiesFromSolids} from "@jscad/regl-renderer";
import {Geom3} from "@jscad/modeling/src/geometries/types";

export function render(objects: Geom3[], canvasRef: HTMLCanvasElement) {
    const perspectiveCamera = cameras.perspective
    const orbitControls = controls.orbit

    canvasRef =  document.getElementById("viewer") as HTMLCanvasElement;

    const width = canvasRef.clientWidth
    const height = canvasRef.clientHeight

    const state: any = {}

    const cameraSettings = {...perspectiveCamera.defaults, position: [5000, 0, 1000], fov: .1}
    console.log("cameraSettings", cameraSettings)
    state.camera = Object.assign({}, cameraSettings)
    // console.log("perspectiveCamera.defaults", perspectiveCamera.defaults)
    perspectiveCamera.setProjection(state.camera, state.camera, {width, height})
    perspectiveCamera.update(state.camera, state.camera)

    state.controls = orbitControls.defaults

    const setupOptions: any = {
        glOptions: {container: canvasRef},
    }
    const renderer = prepareRender(setupOptions)

    const gridOptions = {
        visuals: {
            drawCmd: 'drawGrid',
            show: false
        },
        size: [500, 500],
        ticks: [25, 5],
        // color: [0, 0, 1, 1],
        // subColor: [0, 0, 1, 0.5]
    }

    const axisOptions = {
        visuals: {
            drawCmd: 'drawAxis',
            show: true
        },
        size: 300,
        // alwaysVisible: false,
        // xColor: [0, 0, 1, 1],
        // yColor: [1, 0, 1, 1],
        // zColor: [0, 0, 0, 1]
    }
    const entities = entitiesFromSolids({}, objects as any)

    // assemble the options for rendering
    const renderOptions = {
        camera: state.camera,
        drawCommands: {
            drawAxis: drawCommands.drawAxis,
            drawGrid: drawCommands.drawGrid,
            drawLines: drawCommands.drawLines,
            drawMesh: drawCommands.drawMesh
        },
        // define the visual content
        entities: [
            gridOptions,
            axisOptions,
            ...entities
        ]
    }

    // the heart of rendering, as themes, controls, etc change
    let updateView = true

    const doRotatePanZoom = () => {

        if (rotateDelta[0] || rotateDelta[1]) {
            const updated = orbitControls.rotate({
                controls: state.controls,
                camera: state.camera,
                speed: rotateSpeed
            }, rotateDelta)
            state.controls = {...state.controls, ...updated.controls}
            updateView = true
            rotateDelta = [0, 0]
        }

        if (panDelta[0] || panDelta[1]) {
            const updated = orbitControls.pan({
                controls: state.controls,
                camera: state.camera,
                speed: panSpeed
            }, panDelta)
            state.controls = {...state.controls, ...updated.controls}
            panDelta = [0, 0]
            state.camera.position = updated.camera.position
            state.camera.target = updated.camera.target
            updateView = true
        }

        if (zoomDelta) {
            const updated = orbitControls.zoom({
                controls: state.controls,
                camera: state.camera,
                speed: zoomSpeed
            }, zoomDelta)
            state.controls = {...state.controls, ...updated.controls}
            zoomDelta = 0
            updateView = true
        }
    }

    const updateAndRender = () => {
        doRotatePanZoom()

        if (updateView) {
            const updates = orbitControls.update({controls: state.controls, camera: state.camera})
            state.controls = {...state.controls, ...updates.controls}
            updateView = state.controls.changed // for elasticity in rotate / zoom

            state.camera.position = updates.camera.position
            perspectiveCamera.update(state.camera)

            renderer(renderOptions)
        }
        window.requestAnimationFrame(updateAndRender)
    }
    window.requestAnimationFrame(updateAndRender)

    // convert HTML events (mouse movement) to viewer changes
    let lastX = 0
    let lastY = 0

    const rotateSpeed = 0.002
    const panSpeed = 1
    const zoomSpeed = 0.08
    let rotateDelta = [0, 0]
    let panDelta = [0, 0]
    let zoomDelta = 0
    let pointerDown = false

    const moveHandler = (ev: any) => {
        if (!pointerDown) return
        const dx = lastX - ev.pageX
        const dy = ev.pageY - lastY

        const shiftKey = (ev.shiftKey === true) || (ev.touches && ev.touches.length > 2)
        if (shiftKey) {
            panDelta[0] += dx
            panDelta[1] += dy
        } else {
            rotateDelta[0] -= dx
            rotateDelta[1] -= dy
        }

        lastX = ev.pageX
        lastY = ev.pageY

        ev.preventDefault()
    }
    const downHandler = (ev: any) => {
        pointerDown = true
        lastX = ev.pageX
        lastY = ev.pageY
        canvasRef.setPointerCapture(ev.pointerId)
    }

    const upHandler = (ev: any) => {
        pointerDown = false
        canvasRef.releasePointerCapture(ev.pointerId)
    }

    const wheelHandler = (ev: any) => {
        zoomDelta += ev.deltaY
        ev.preventDefault()
    }

    canvasRef.onpointermove = moveHandler
    canvasRef.onpointerdown = downHandler
    canvasRef.onpointerup = upHandler
    canvasRef.onwheel = wheelHandler
}

