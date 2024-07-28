import './App.css'
import {createTheme, MantineProvider} from '@mantine/core';
import '@mantine/core/styles.css';
import {useCallback, useEffect, useMemo, useRef} from "react";
import {loadOpenCV} from "./scripts/opencv.ts";
import FormGenerate from "./components/form-generate/FormGenerate.tsx";
import {$cvLoaded, $textA, $textB} from "./store.ts";
import {generatePolygons} from "./scripts/contours.ts";
import {combineZigZag, fuseLetters} from "./scripts/jscad.ts";
import {render} from "./scripts/render.ts";

const theme = createTheme({});
const extrusionDist = 500;

function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const generate = useCallback(() => {
        const polyA = generatePolygons($textA.get())
        const polyB = generatePolygons($textB.get())
        const extrusionsA = fuseLetters(polyA, extrusionDist, -Math.PI / 4)
        const extrusionsB = fuseLetters(polyB, extrusionDist, Math.PI / 4)
        console.log("extrusionsB", extrusionsB)
        const combine = combineZigZag(extrusionsA, extrusionsB)
        console.log("combine", combine);
        render([extrusionsB[0].mesh], canvasRef.current!)
    }, []);

    const viewer = useMemo(() => {
        return <div id="viewer" style={{width: 800, height: 500, backgroundColor: "green"}}></div>
    }, [])

    useEffect(() => {
        loadOpenCV(() => {
            $cvLoaded.set(true)
        });
    }, []);

    return (
        <MantineProvider theme={theme} defaultColorScheme="dark">
            {/*<canvas ref={canvasRef} width={1000} height={400}/>*/}
            {viewer}
            <FormGenerate onGenerate={generate}/>
        </MantineProvider>
    )
}

export default App
