import './App.css'
import {AppShell, createTheme, MantineProvider, ScrollArea} from '@mantine/core';
import '@mantine/core/styles.css';
import {useCallback, useEffect, useMemo, useRef} from "react";
import {loadOpenCV} from "./scripts/opencv.ts";
import FormGenerate from "./components/form-generate/FormGenerate.tsx";
import {$cvLoaded, $mesh, $reductionStrategy, $textA, $textB} from "./store.ts";
import {generatePolygons} from "./scripts/contours.ts";
import {combineWithOverlap, combineNone, fuseLetters} from "./scripts/jscad.ts";
import {render} from "./scripts/render.ts";
import {ReductionStrategy} from "./types.ts";
import {Geom3} from "@jscad/modeling/src/geometries/types";

const theme = createTheme({});
const extrusionDist = 500;

function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const generate = useCallback(() => {
        const polyA = generatePolygons($textA.get())
        // const polyB = generatePolygons($textB.get())
        // const extrusionsA = fuseLetters(polyA, extrusionDist, -Math.PI / 4)
        // const extrusionsB = fuseLetters(polyB, extrusionDist, Math.PI / 4)
        // let res: Geom3[] = [];
        // if ($reductionStrategy.get() === ReductionStrategy.SIMPLE) {
        //     res = combineWithOverlap(extrusionsA, extrusionsB)
        // } else {
        //     res = combineNone(extrusionsA, extrusionsB)
        // }
        //
        // console.log("res", res);
        // render(res, canvasRef.current!);
        // $mesh.set(res);
    }, []);

    const viewer = useMemo(() => {
        return <div id="viewer" style={{width: 800, height: 500, backgroundColor: "green", display: 'none'}}></div>
    }, [])
    const segmentation = useMemo(() => {
        return <canvas id="segmentation" style={{width: 1000, height: 100}}></canvas>
    }, [])

    useEffect(() => {
        loadOpenCV(() => {
            $cvLoaded.set(true)
        });
    }, []);


    return (
        <MantineProvider theme={theme}>
            <AppShell
                padding="md"
                navbar={{
                    width: 200,
                    breakpoint: 'sm',
                    collapsed: {mobile: false},
                }}
            >
                <AppShell.Navbar p="xs">
                    <ScrollArea h="100%">
                        <FormGenerate onGenerate={generate}/>
                    </ScrollArea>
                </AppShell.Navbar>

                <AppShell.Main>
                    {viewer}
                    {segmentation}
                </AppShell.Main>
            </AppShell>
        </MantineProvider>
    )
}

export default App
