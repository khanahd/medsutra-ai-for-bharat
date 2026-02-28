# Clinical LLM Service

## Overview

The Clinical LLM Service provides AI-powered text generation, embedding, and classification capabilities using a fine-tuned medical language model trained on MIMIC and Indian clinical datasets.

## Features

- **Text Generation**: Generate clinical summaries, documentation, and recommendations
- **Embeddings**: Create vector representations of medical text for similarity search
- **Classification**: Categorize medical text into predefined labels
- **Structured Extraction**: Extract structured data from unstructured clinical text
- **Caching**: Automatic response caching to reduce API calls
- **Monitoring**: Real-time performance tracking and metrics
- **Retry Logic**: Automatic retry with exponential backoff for failed requests

## Configuration

### Environment Variables

```env
# LLM Configuration
LLM_API_KEY=your_api_key_here
LLM_MODEL=gpt-4
LLM_ENDPOINT=https://api.openai.com/v1
REQUEST_TIMEOUT_MS=30000
```

### Supported Models

- OpenAI GPT-4 / GPT-3.5
- Azure OpenAI
- Custom fine-tuned models (OpenAI-compatible API)

## Usage

### Basic Text Generation

```typescript
import { clinicalLLM } from './services/llm';

// Generate clinical summary
const summary = await clinicalLLM.generateText(
  'Summarize the following patient case',
  ['Patient presents with fever and cough...']
);
```

### Generate Embeddings

```typescript
const embedding = await clinicalLLM.embed('Patient has diabetes mellitus type 2');

console.log(embedding.vector); // [0.123, -0.456, ...]
console.log(embedding.dimension); // 1536
```

### Text Classification

```typescript
const classification = await clinicalLLM.classify(
  'Patient reports chest pain and shortness of breath',
  ['Cardiology', 'Pulmonology', 'Emergency']
);

console.log(classification.label); // 'Cardiology'
console.log(classification.confidence); // 0.85
```

### Structured Data Extraction

```typescript
const schema = {
  symptoms: 'array of strings',
  diagnosis: 'string',
  medications: 'array of objects with name and dosage'
};

const extracted = await clinicalLLM.extractStructured(
  'Patient has fever, cough. Diagnosed with pneumonia. Prescribed amoxicillin 500mg.',
  schema
);
```

## Caching

The LLM service automatically caches responses to improve performance and reduce API costs.

### Cache Configuration

```typescript
import { textGenerationCache } from './services/llm';

// Get cache statistics
const stats = textGenerationCache.getStats();
console.log(stats);
// {
//   size: 150,
//   maxSize: 1000,
//   hitRate: 0.65,
//   totalHits: 450
// }

// Clear cache
textGenerationCache.clear();
```

### Cache Types

- **Text Generation Cache**: 1000 entries, 60 min TTL
- **Embedding Cache**: 5000 entries, 120 min TTL
- **Classification Cache**: 500 entries, 30 min TTL

## Monitoring

### Performance Metrics

```typescript
import { llmMonitor } from './services/llm';

// Get current metrics
const metrics = llmMonitor.getMetrics();
console.log(metrics);
// {
//   totalRequests: 1250,
//   successfulRequests: 1200,
//   failedRequests: 50,
//   averageLatencyMs: 1500,
//   errorRate: 0.04,
//   requestsPerMinute: 25
// }

// Get performance summary for last hour
const summary = llmMonitor.getPerformanceSummary(60);

// Check if performance is degraded
if (llmMonitor.isPerformanceDegraded()) {
  console.warn('LLM performance is degraded!');
}

// Generate detailed report
const report = llmMonitor.generateReport();
console.log(report);
```

### API Endpoints

#### Health Check
```
GET /api/llm/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Metrics
```
GET /api/llm/metrics
```

Response:
```json
{
  "metrics": {
    "totalRequests": 1250,
    "successfulRequests": 1200,
    "averageLatencyMs": 1500,
    "errorRate": 0.04
  },
  "cache": {
    "size": 150,
    "hitRate": 0.65
  },
  "isDegraded": false
}
```

#### Performance Report
```
GET /api/llm/report
```

Returns a detailed text report of LLM performance.

#### Model Metadata
```
GET /api/llm/metadata
```

Response:
```json
{
  "modelId": "gpt-4",
  "version": "1.0.0",
  "trainingDatasets": ["MIMIC-III", "MIMIC-IV", "ICMR-India"],
  "demographicComposition": {
    "ageDistribution": {...},
    "genderDistribution": {...}
  },
  "performanceMetrics": {
    "accuracy": 0.92,
    "precision": 0.90
  }
}
```

#### Clear Cache
```
POST /api/llm/cache/clear
```

#### Reset Metrics
```
POST /api/llm/metrics/reset
```

## Model Metadata

The LLM service tracks model metadata including:

- Training datasets used
- Demographic composition of training data
- Performance metrics (accuracy, precision, recall, F1)
- Demographic parity scores
- Last update timestamp

This metadata is used for:
- Bias monitoring
- Performance tracking
- Compliance reporting
- Model versioning

## Performance Optimization

### Best Practices

1. **Use Caching**: Identical requests are automatically cached
2. **Batch Operations**: Process multiple items together when possible
3. **Monitor Performance**: Track metrics and set up alerts
4. **Optimize Prompts**: Shorter, clearer prompts reduce latency
5. **Set Timeouts**: Configure appropriate timeout values

### Performance Targets

- Text Generation: < 10 seconds
- Embeddings: < 2 seconds
- Classification: < 5 seconds
- Cache Hit Rate: > 50%
- Error Rate: < 5%

## Error Handling

The LLM service implements robust error handling:

- **Automatic Retries**: Up to 3 retries with exponential backoff
- **Timeout Protection**: Configurable request timeouts
- **Graceful Degradation**: Returns error without crashing
- **Detailed Logging**: All errors logged with context

### Common Errors

**API Key Invalid**
```
Error: LLM API error: 401 Unauthorized
```
Solution: Check LLM_API_KEY in environment variables

**Timeout**
```
Error: Request timeout after 30000ms
```
Solution: Increase REQUEST_TIMEOUT_MS or optimize prompt

**Rate Limit**
```
Error: LLM API error: 429 Too Many Requests
```
Solution: Implement request throttling or upgrade API plan

## Security Considerations

1. **API Key Protection**: Never commit API keys to version control
2. **Input Validation**: Validate all inputs before sending to LLM
3. **Output Sanitization**: Sanitize LLM outputs before displaying
4. **Rate Limiting**: Implement rate limiting to prevent abuse
5. **Audit Logging**: Log all LLM requests for compliance

## Compliance

### HIPAA Requirements

✓ No PHI sent to external LLM without de-identification
✓ Audit logging of all LLM operations
✓ Secure API key storage
✓ Encrypted data transmission (TLS 1.3)

### Best Practices

- De-identify patient data before sending to LLM
- Use on-premise models for sensitive data
- Implement data retention policies
- Regular security audits

## Troubleshooting

### High Latency

1. Check network connectivity
2. Review cache hit rate
3. Optimize prompt length
4. Consider using faster model

### High Error Rate

1. Verify API key is valid
2. Check API service status
3. Review error logs for patterns
4. Ensure proper retry configuration

### Cache Not Working

1. Verify cache is enabled
2. Check cache size limits
3. Review TTL settings
4. Monitor cache statistics
