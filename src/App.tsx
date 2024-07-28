import './App.css'
import {Button, createTheme, MantineProvider} from '@mantine/core';
import '@mantine/core/styles.css';
import {useCallback, useEffect, useMemo, useRef} from "react";
import {loadOpenCV} from "./scripts/opencv.ts";
import FormGenerate from "./components/form-generate/FormGenerate.tsx";
import {$cvLoaded, $mesh, $textA, $textB} from "./store.ts";
import {generatePolygons} from "./scripts/contours.ts";
import {combineWithOverlap, download, fuseLetters} from "./scripts/jscad.ts";
import {render} from "./scripts/render.ts";
import {useStore} from "@nanostores/react";

const theme = createTheme({});
const extrusionDist = 500;

function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mesh = useStore($mesh);

    const generate = useCallback(() => {
        const polyA = generatePolygons($textA.get())
        const polyB = generatePolygons($textB.get())
        const extrusionsA = fuseLetters(polyA, extrusionDist, -Math.PI / 4)
        const extrusionsB = fuseLetters(polyB, extrusionDist, Math.PI / 4)
        const combine = combineWithOverlap(extrusionsA, extrusionsB)
        // const combine2 = combineWithOverlap(extrusionsA, extrusionsB)
        console.log("combine", combine);
        render(combine, canvasRef.current!);
        $mesh.set(combine);
    }, []);

    const viewer = useMemo(() => {
        return <div id="viewer" style={{width: 800, height: 500, backgroundColor: "green"}}></div>
    }, [])

    useEffect(() => {
        loadOpenCV(() => {
            $cvLoaded.set(true)
        });
    }, []);

    const downloadMesh = useCallback(() => {
        const mesh = $mesh.get();
        const name = $textA.get().toLowerCase() + "_" + $textB.get().toLowerCase();
        download(mesh, name);
    }, []);

    return (
        <MantineProvider theme={theme} defaultColorScheme="dark">
            {/*<canvas ref={canvasRef} width={1000} height={400}/>*/}
            {viewer}
            {mesh.length === 0 && <FormGenerate onGenerate={generate}/>}
            {mesh.length !== 0 &&  <Button onClick={downloadMesh}>Generate</Button>}
        </MantineProvider>
    )
}

export default App
