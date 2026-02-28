/**
 * Complete AI Pipeline Integration Example
 * Demonstrates how to use LLM, RAG, Explainability, and Guardrails together
 */

import { clinicalLLM } from '../src/services/llm';
import { ragSystem, documentLoader } from '../src/services/rag';
import { explainabilityEngine } from '../src/services/explainability';
import { guardrailSystem } from '../src/services/guardrails';

/**
 * Example 1: Safe Clinical Suggestion Generation
 */
async function generateSafeClinicalSuggestion(patientData: any) {
  console.log('=== Safe Clinical Suggestion Generation ===\n');

  // Step 1: Generate suggestion using LLM
  console.log('Step 1: Generating suggestion with LLM...');
  const prompt = `Based on this patient data, suggest next clinical steps: ${JSON.stringify(patientData)}`;
  const suggestion = await clinicalLLM.generateText(prompt);
  console.log(`Generated: ${suggestion}\n`);

  // Step 2: Validate against guardrails
  console.log('Step 2: Validating with guardrails...');
  const validation = await guardrailSystem.validateStatement(suggestion, 'workflow_engine');
  console.log(`Verified: ${validation.isVerifiable}`);
  console.log(`Confidence: ${(validation.confidence * 100).toFixed(0)}%`);
  console.log(`Flagged: ${validation.flagged}\n`);

  if (validation.flagged) {
    throw new Error(`Suggestion flagged: ${validation.reason}`);
  }

  // Step 3: Generate explanation
  console.log('Step 3: Generating explanation...');
  const explanation = await explainabilityEngine.explainSuggestion(
    'suggestion_001',
    'WORKFLOW',
    suggestion,
    []
  );
  console.log(`Confidence: ${(explanation.confidenceLevel * 100).toFixed(0)}%`);
  console.log(`Evidence sources: ${explanation.evidenceSources.length}`);
  console.log(`Guidelines: ${explanation.clinicalGuidelines.join(', ')}\n`);

  // Step 4: Add disclaimer
  console.log('Step 4: Adding AI disclaimer...');
  const finalOutput = guardrailSystem.addDisclaimer(suggestion);

  return {
    suggestion: finalOutput,
    explanation,
    validation,
    confidence: explanation.confidenceLevel,
  };
}

/**
 * Example 2: Radiology Report Analysis with Safety
 */
async function analyzeRadiologyReport(reportText: string) {
  console.log('=== Radiology Report Analysis ===\n');

  // Step 1: Extract findings using LLM
  console.log('Step 1: Extracting findings...');
  const findings = await clinicalLLM.extractStructured(reportText, {
    suspiciousTerms: 'array of strings',
    organ: 'string',
    size: 'string',
    characteristics: 'array of strings',
  });
  console.log(`Findings: ${JSON.stringify(findings, null, 2)}\n`);

  // Step 2: Assess risk level
  console.log('Step 2: Assessing risk level...');
  const riskLevel = findings.suspiciousTerms?.length > 0 ? 'HIGH' : 'LOW';
  console.log(`Risk Level: ${riskLevel}\n`);

  // Step 3: Explain risk
  console.log('Step 3: Explaining risk...');
  const riskExplanation = await explainabilityEngine.explainRiskFlag(riskLevel, [
    { term: findings.suspiciousTerms?.[0], severity: 0.9 },
  ]);
  console.log(`Clinical Significance: ${riskExplanation.clinicalSignificance}`);
  console.log(`Recommended Actions: ${riskExplanation.recommendedActions.join(', ')}\n`);

  // Step 4: Validate explanation
  console.log('Step 4: Validating explanation...');
  const validation = await guardrailSystem.validateStatement(
    riskExplanation.clinicalSignificance,
    'radiology_analyzer'
  );
  console.log(`Validated: ${validation.isVerifiable}\n`);

  return {
    findings,
    riskLevel,
    explanation: riskExplanation,
    validation,
  };
}

/**
 * Example 3: Document Generation with Validation
 */
async function generateValidatedDocument(patientSnapshot: any, documentType: string) {
  console.log('=== Document Generation with Validation ===\n');

  // Step 1: Generate document
  console.log('Step 1: Generating document...');
  const prompt = `Generate a ${documentType} for this patient: ${JSON.stringify(patientSnapshot)}`;
  const document = await clinicalLLM.generateText(prompt);
  console.log(`Generated ${document.length} characters\n`);

  // Step 2: Validate entire document
  console.log('Step 2: Validating document...');
  const docValidation = await guardrailSystem.validateDocument(document, 'documentation_assistant');
  console.log(`Valid: ${docValidation.isValid}`);
  console.log(`Invalid statements: ${docValidation.invalidStatements.length}\n`);

  if (!docValidation.isValid) {
    console.log('Invalid statements found:');
    docValidation.invalidStatements.forEach((stmt, idx) => {
      console.log(`${idx + 1}. ${stmt}`);
    });
    throw new Error('Document contains unvalidated statements');
  }

  // Step 3: Add disclaimer
  console.log('Step 3: Adding disclaimer...');
  const finalDocument = guardrailSystem.addDisclaimer(document);

  return {
    document: finalDocument,
    validation: docValidation,
  };
}

/**
 * Example 4: Query RAG and Cite Sources
 */
async function queryKnowledgeBase(query: string) {
  console.log('=== Knowledge Base Query ===\n');

  // Step 1: Query RAG system
  console.log('Step 1: Querying RAG system...');
  const ragResult = await ragSystem.query({
    query,
    topK: 3,
    filters: { minCredibility: 0.8 },
  });
  console.log(`Found ${ragResult.documents.length} relevant documents\n`);

  // Step 2: Display results with citations
  console.log('Step 2: Relevant documents:');
  ragResult.documents.forEach((doc, idx) => {
    console.log(`\n${idx + 1}. ${doc.title}`);
    console.log(`   Source: ${doc.source}`);
    console.log(`   Credibility: ${(doc.credibility * 100).toFixed(0)}%`);
    console.log(`   Relevance: ${(ragResult.relevanceScores[idx] * 100).toFixed(0)}%`);
  });

  // Step 3: Get citations for a statement
  console.log('\n\nStep 3: Getting citations...');
  const citations = await explainabilityEngine.citeSources(query);
  console.log(`Found ${citations.length} citations\n`);

  citations.forEach((citation, idx) => {
    console.log(`${idx + 1}. ${citation.source}`);
    console.log(`   "${citation.relevantText}"`);
    console.log(`   Credibility: ${(citation.credibilityScore * 100).toFixed(0)}%\n`);
  });

  return {
    documents: ragResult.documents,
    citations,
  };
}

/**
 * Example 5: Initialize System and Run Examples
 */
async function main() {
  try {
    console.log('Initializing MedSutra AI Services...\n');

    // Initialize RAG system with sample guidelines
    const documents = await documentLoader.loadSampleGuidelines();
    await ragSystem.initialize(documents);
    console.log(`RAG system initialized with ${documents.length} documents\n`);
    console.log('='.repeat(60) + '\n');

    // Example 1: Safe suggestion
    const patientData = {
      age: 65,
      symptoms: ['chest pain', 'shortness of breath'],
      history: ['smoking 30 pack-years'],
    };
    const suggestion = await generateSafeClinicalSuggestion(patientData);
    console.log('\n' + '='.repeat(60) + '\n');

    // Example 2: Radiology analysis
    const reportText =
      'CT Thorax shows 3.2 cm spiculated mass in right upper lobe with mediastinal lymphadenopathy';
    const analysis = await analyzeRadiologyReport(reportText);
    console.log('\n' + '='.repeat(60) + '\n');

    // Example 3: Document generation
    const patientSnapshot = {
      name: '[PATIENT_NAME]',
      age: 65,
      diagnosis: 'Suspected lung cancer',
    };
    const doc = await generateValidatedDocument(patientSnapshot, 'referral letter');
    console.log('\n' + '='.repeat(60) + '\n');

    // Example 4: Knowledge base query
    const query = 'lung cancer screening guidelines';
    const knowledge = await queryKnowledgeBase(query);
    console.log('\n' + '='.repeat(60) + '\n');

    console.log('\nAll examples completed successfully!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  main();
}

export {
  generateSafeClinicalSuggestion,
  analyzeRadiologyReport,
  generateValidatedDocument,
  queryKnowledgeBase,
};
