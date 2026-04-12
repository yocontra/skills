// Ghidra headless script: decompile all functions to a C file.
// Usage: analyzeHeadless ... -postScript DecompileAll.java /output/path.c
// @category Analysis
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;
import java.io.FileWriter;
import java.io.PrintWriter;

public class DecompileAll extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outputPath = args.length > 0 ? args[0] : "/tmp/decompiled_output.c";
        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);
        PrintWriter out = new PrintWriter(new FileWriter(outputPath));
        out.println("// Decompiled by Ghidra: " + currentProgram.getName());
        out.println();
        FunctionIterator funcs = currentProgram.getFunctionManager().getFunctions(true);
        int count = 0;
        while (funcs.hasNext()) {
            Function func = funcs.next();
            if (func.isExternal()) continue;
            DecompileResults results = decomp.decompileFunction(func, 30, monitor);
            if (results.decompileCompleted()) {
                out.println("// Function: " + func.getName() + " @ " + func.getEntryPoint());
                out.println(results.getDecompiledFunction().getC());
                out.println();
                count++;
            }
        }
        out.close();
        decomp.dispose();
        println("Decompiled " + count + " functions to " + outputPath);
    }
}
