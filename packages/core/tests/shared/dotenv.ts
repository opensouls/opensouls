import "dotenv/config"
import { SpanProcessorType, startInstrumentation } from './instrumentation.ts';

startInstrumentation({
  spanProcessorType: SpanProcessorType.Simple,
})
