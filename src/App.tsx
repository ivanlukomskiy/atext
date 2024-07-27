import './App.css'
import {Button, createTheme, MantineProvider, Stack, TextInput} from '@mantine/core';
import '@mantine/core/styles.css';
import {useEffect} from "react";
import {loadOpenCV} from "./scripts/opencv.ts";
import FormGenerate from "./components/form-generate/FormGenerate.tsx";
import {$cvLoaded} from "./store.ts";

const theme = createTheme({});

function App() {
    useEffect(() => {
        loadOpenCV(() => {
            $cvLoaded.set(true)
        });
    }, []);

    return (
        <MantineProvider theme={theme} defaultColorScheme="dark">
            <FormGenerate />
        </MantineProvider>
    )
}

export default App
