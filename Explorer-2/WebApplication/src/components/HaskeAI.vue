<template>
  <div class="haske-ai-container">
    <div class="ai-header">
      <h2>Haske AI Segmentation</h2>
      <p class="subtitle">Automated brain tumor segmentation using deep learning</p>
      <a href="https://github.com/mailabhaske/models" target="_blank" class="github-link">
        <i class="bi bi-github"></i> View all models on GitHub
      </a>
    </div>

    <div class="ai-content">
      <div class="model-selection">
        <div class="section-header">
          <h4>Model Selection</h4>
          <p>Choose from our collection of pre-trained models</p>
        </div>
        
        <div class="model-gallery">
          <div 
            v-for="model in availableModels" 
            :key="model" 
            class="model-card"
            :class="{ 'selected': selectedModel === model }"
            @click="selectedModel = model"
          >
            <div class="model-icon">
              <i class="bi bi-robot"></i>
            </div>
            <div class="model-info">
              <h5>{{ formatModelName(model) }}</h5>
              <p class="model-tag">{{ getModelTag(model) }}</p>
            </div>
          </div>
        </div>
        
        <div class="selected-model-display">
          <label>Selected Model:</label>
          <div class="selected-model">
            {{ selectedModel }}
            <button 
              class="info-btn"
              @click="showModelInfo(selectedModel)"
              title="Model information"
            >
              <i class="bi bi-info-circle"></i>
            </button>
          </div>
        </div>
      </div>

      <div v-if="transferInProgress" class="transfer-status">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p>Transferring DICOM data from Orthanc...</p>
      </div>

      <div v-if="!transferInProgress && orthancStudyId" class="dicom-info">
        <div class="section-header">
          <h4>Selected Study</h4>
          <p>Details of the DICOM study being processed</p>
        </div>
        <div class="study-details">
          <div class="detail-row">
            <i class="bi bi-person"></i>
            <span><strong>Patient:</strong> {{ studyDetails.PatientName || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <i class="bi bi-calendar"></i>
            <span><strong>Study Date:</strong> {{ studyDetails.StudyDate || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <i class="bi bi-collection"></i>
            <span><strong>Modalities:</strong> {{ studyModalities.join(', ') }}</span>
          </div>
        </div>
      </div>

      <div class="action-buttons">
        <button 
          @click="runSegmentation" 
          :disabled="!orthancStudyId || processing"
          class="btn btn-primary run-btn"
        >
          <span v-if="processing">
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            Processing...
          </span>
          <span v-else>
            <i class="bi bi-play-fill"></i> Run Segmentation
          </span>
        </button>
      </div>

      <div v-if="results" class="results-section">
        <div class="section-header">
          <h3>Segmentation Results</h3>
          <p>Review and export the segmentation outputs</p>
        </div>
        <div class="results-grid">
          <div class="result-card">
            <div class="result-header">
              <h5>Original</h5>
              <button class="zoom-btn" @click="zoomImage(originalImage)">
                <i class="bi bi-zoom-in"></i>
              </button>
            </div>
            <img :src="originalImage" alt="Original slice" class="result-image">
          </div>
          <div class="result-card">
            <div class="result-header">
              <h5>Segmentation</h5>
              <button class="zoom-btn" @click="zoomImage(segmentationImage)">
                <i class="bi bi-zoom-in"></i>
              </button>
            </div>
            <img :src="segmentationImage" alt="Segmentation" class="result-image">
          </div>
          <div class="result-card">
            <div class="result-header">
              <h5>Overlay</h5>
              <button class="zoom-btn" @click="zoomImage(overlayImage)">
                <i class="bi bi-zoom-in"></i>
              </button>
            </div>
            <img :src="overlayImage" alt="Overlay" class="result-image">
          </div>
        </div>

        <div class="results-actions">
          <button @click="downloadResults" class="btn btn-outline-primary">
            <i class="bi bi-download"></i> Download Results
          </button>
          <button @click="saveToOrthanc" class="btn btn-outline-success">
            <i class="bi bi-save"></i> Save to Orthanc
          </button>
          <button @click="reset" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-repeat"></i> Process Another
          </button>
        </div>
      </div>
    </div>

    <!-- Modal for image zoom -->
    <div v-if="zoomedImage" class="modal-overlay" @click="zoomedImage = null">
      <div class="modal-content" @click.stop>
        <button class="close-modal" @click="zoomedImage = null">
          <i class="bi bi-x-lg"></i>
        </button>
        <img :src="zoomedImage" class="zoomed-image" alt="Zoomed image">
      </div>
    </div>

    <!-- Modal for model info -->
    <div v-if="modelInfo" class="modal-overlay" @click="modelInfo = null">
      <div class="modal-content info-modal" @click.stop>
        <button class="close-modal" @click="modelInfo = null">
          <i class="bi bi-x-lg"></i>
        </button>
        <h4>{{ modelInfo.name }}</h4>
        <div class="info-grid">
          <div>
            <strong>Version:</strong> {{ modelInfo.version }}
          </div>
          <div>
            <strong>Type:</strong> {{ modelInfo.type }}
          </div>
          <div>
            <strong>Training Data:</strong> {{ modelInfo.trainingData }}
          </div>
          <div>
            <strong>Performance:</strong> {{ modelInfo.performance }}
          </div>
        </div>
        <div class="model-description">
          {{ modelInfo.description }}
        </div>
        <a :href="modelInfo.githubLink" target="_blank" class="github-link">
          <i class="bi bi-github"></i> View on GitHub
        </a>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'HaskeAI',
  data() {
    return {
      availableModels: [
        'mailabhaske/glioma_unet:latest',
        'mailabhaske/brain_segmentation:v2',
        'mailabhaske/tumor_detection:prod',
        'mailabhaske/full_brain:v1',
        'mailabhaske/lesion_detection:beta',
        'mailabhaske/pediatric_tumors:latest'
      ],
      selectedModel: 'mailabhaske/glioma_unet:latest',
      orthancStudyId: null,
      studyDetails: {},
      studyModalities: [],
      transferInProgress: false,
      processing: false,
      results: null,
      originalImage: '',
      segmentationImage: '',
      overlayImage: '',
      zoomedImage: null,
      modelInfo: null,
      orthancBaseUrl: 'https://haske.online:5000',
      apiBaseUrl: 'https://haske.online:8090',
      modelDetails: {
        'mailabhaske/glioma_unet:latest': {
          name: 'Glioma U-Net',
          version: '1.0.0',
          type: '3D U-Net',
          trainingData: 'BraTS 2020 (n=369)',
          performance: 'Dice 0.85 ± 0.07',
          description: 'Specialized for glioma segmentation in adult patients. Handles both high and low grade gliomas.',
          githubLink: 'https://github.com/mailabhaske/models/tree/main/glioma_unet'
        },
        'mailabhaske/brain_segmentation:v2': {
          name: 'Brain Segmentation',
          version: '2.0.0',
          type: '3D U-Net',
          trainingData: 'Multiple datasets (n=1200)',
          performance: 'Dice 0.92 ± 0.03',
          description: 'General brain tissue segmentation including white matter, gray matter, and CSF.',
          githubLink: 'https://github.com/mailabhaske/models/tree/main/brain_segmentation'
        },
        'mailabhaske/tumor_detection:prod': {
          name: 'Tumor Detection',
          version: '1.2.0',
          type: '3D CNN',
          trainingData: 'Private dataset (n=850)',
          performance: 'Sensitivity 0.94, Specificity 0.91',
          description: 'Detection model for various brain tumor types with high sensitivity.',
          githubLink: 'https://github.com/mailabhaske/models/tree/main/tumor_detection'
        },
        'mailabhaske/full_brain:v1': {
          name: 'Full Brain Analysis',
          version: '1.0.0',
          type: 'Multi-task Network',
          trainingData: 'Combined datasets (n=2000)',
          performance: 'Average Dice 0.89',
          description: 'Comprehensive brain analysis including structures, ventricles and abnormalities.',
          githubLink: 'https://github.com/mailabhaske/models/tree/main/full_brain'
        },
        'mailabhaske/lesion_detection:beta': {
          name: 'Lesion Detection',
          version: '0.9.0',
          type: '3D ResNet',
          trainingData: 'MS lesion dataset (n=500)',
          performance: 'Dice 0.82 ± 0.08',
          description: 'Specialized for multiple sclerosis lesion detection and segmentation.',
          githubLink: 'https://github.com/mailabhaske/models/tree/main/lesion_detection'
        },
        'mailabhaske/pediatric_tumors:latest': {
          name: 'Pediatric Tumors',
          version: '1.1.0',
          type: '3D U-Net',
          trainingData: 'Pediatric dataset (n=300)',
          performance: 'Dice 0.83 ± 0.09',
          description: 'Optimized for pediatric brain tumor segmentation with smaller structures.',
          githubLink: 'https://github.com/mailabhaske/models/tree/main/pediatric_tumors'
        }
      }
    };
  },
  mounted() {
    if (this.$route.query.studyId) {
      this.orthancStudyId = this.$route.query.studyId;
      this.fetchStudyDetails();
    }
  },
  methods: {
    formatModelName(model) {
      return model.split(':')[0].split('/')[1].replace(/_/g, ' ');
    },
    getModelTag(model) {
      return model.split(':')[1];
    },
    async fetchStudyDetails() {
      try {
        const response = await axios.get(`${this.orthancBaseUrl}/studies/${this.orthancStudyId}`);
        this.studyDetails = response.data.MainDicomTags || {};
        
        const seriesResponse = await axios.get(`${this.orthancBaseUrl}/studies/${this.orthancStudyId}/series`);
        const modalities = new Set();
        
        for (const series of seriesResponse.data) {
          const seriesDetails = await axios.get(`${this.orthancBaseUrl}/series/${series.ID}`);
          if (seriesDetails.data.MainDicomTags?.Modality) {
            modalities.add(seriesDetails.data.MainDicomTags.Modality);
          }
        }
        
        this.studyModalities = Array.from(modalities);
      } catch (error) {
        console.error('Error fetching study details:', error);
        alert('Failed to fetch study details from Orthanc');
      }
    },
    async runSegmentation() {
      if (!this.orthancStudyId) {
        alert('No study selected');
        return;
      }

      this.processing = true;
      try {
        console.log('Initiating backend processing...');
        const processResponse = await axios.post(
          `${this.apiBaseUrl}/process-orthanc-study`,
          {
            orthancStudyId: this.orthancStudyId,
            model: this.selectedModel
          },
          {
            timeout: 300000 // 5 minute timeout
          }
        );

        // Handle response
        this.results = processResponse.data;
        this.originalImage = processResponse.data.original_slice || '';
        this.segmentationImage = processResponse.data.segmentation || '';
        this.overlayImage = processResponse.data.overlay || '';

      } catch (error) {
        console.error('Processing error:', error);
        alert(`Processing failed: ${error.response?.data?.error || error.message}`);
      } finally {
        this.processing = false;
      }
    },
    downloadResults() {
      if (!this.results?.zip_file) {
        alert('No results available to download');
        return;
      }
      const link = document.createElement('a');
      link.href = `data:application/zip;base64,${this.results.zip_file}`;
      link.download = 'segmentation_results.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    async saveToOrthanc() {
      if (!this.results?.dicom_seg) {
        alert('No segmentation results available to save');
        return;
      }
      
      try {
        const formData = new FormData();
        const blob = new Blob([this.results.dicom_seg], { type: 'application/dicom' });
        formData.append('file', blob, 'segmentation.dcm');
        
        await axios.post(`${this.orthancBaseUrl}/instances`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        alert('Segmentation saved successfully to Orthanc!');
      } catch (error) {
        console.error('Error saving to Orthanc:', error);
        alert('Failed to save segmentation to Orthanc.');
      }
    },
    zoomImage(image) {
      if (!image) return;
      this.zoomedImage = image;
    },
    showModelInfo(model) {
      this.modelInfo = this.modelDetails[model] || {
        name: this.formatModelName(model),
        version: this.getModelTag(model),
        type: '3D U-Net',
        trainingData: 'Not specified',
        performance: 'Not specified',
        description: 'No additional information available for this model.',
        githubLink: 'https://github.com/mailabhaske/models'
      };
    },
    reset() {
      this.results = null;
      this.originalImage = '';
      this.segmentationImage = '';
      this.overlayImage = '';
    }
  }
};
</script>

<style scoped>
.haske-ai-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  background: #f8f9fa;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.ai-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.subtitle {
  color: #6c757d;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.github-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #6c757d;
  text-decoration: none;
  transition: color 0.2s;
}

.github-link:hover {
  color: #0d6efd;
}

.section-header {
  margin-bottom: 1.5rem;
}

.section-header h4 {
  margin-bottom: 0.25rem;
}

.section-header p {
  color: #6c757d;
  font-size: 0.9rem;
  margin-bottom: 0;
}

.model-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem;
}

.model-card {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.model-card:hover {
  border-color: #0d6efd;
  box-shadow: 0 2px 8px rgba(13, 110, 253, 0.1);
}

.model-card.selected {
  border-color: #0d6efd;
  background-color: #f0f7ff;
}

.model-icon {
  width: 40px;
  height: 40px;
  background: #0d6efd;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.2rem;
}

.model-info h5 {
  margin-bottom: 0.25rem;
  font-size: 1rem;
  color: #212529;
}

.model-tag {
  font-size: 0.75rem;
  color: #6c757d;
  background: #f1f1f1;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  display: inline-block;
  margin-top: 0.25rem;
}

.selected-model-display {
  margin-top: 1.5rem;
}

.selected-model {
  background: white;
  border: 1px solid #ced4da;
  border-radius: 5px;
  padding: 0.75rem;
  margin-top: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-btn {
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
}

.info-btn:hover {
  color: #0d6efd;
}

.transfer-status {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1rem 0;
  padding: 1rem;
  background: #e9ecef;
  border-radius: 5px;
}

.dicom-info {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.study-details {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.detail-row i {
  color: #0d6efd;
}

.action-buttons {
  text-align: center;
  margin: 2rem 0;
}

.run-btn {
  padding: 0.75rem 2rem;
  font-size: 1.1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.results-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #dee2e6;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin: 2rem 0;
}

.result-card {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.zoom-btn {
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
}

.zoom-btn:hover {
  color: #0d6efd;
}

.result-image {
  width: 100%;
  height: auto;
  border-radius: 5px;
  margin-top: 0.5rem;
  cursor: pointer;
  transition: transform 0.2s;
}

.result-image:hover {
  transform: scale(1.02);
}

.results-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  position: relative;
  max-width: 80%;
  max-height: 80%;
  overflow: auto;
}

.close-modal {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
  padding: 0.5rem;
}

.close-modal:hover {
  color: #212529;
}

.zoomed-image {
  max-width: 100%;
  max-height: 70vh;
  display: block;
  margin: 0 auto;
}

.info-modal {
  max-width: 600px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin: 1.5rem 0;
}

.model-description {
  margin: 1.5rem 0;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .haske-ai-container {
    padding: 1rem;
  }
  
  .results-grid {
    grid-template-columns: 1fr;
  }
  
  .model-gallery {
    grid-template-columns: 1fr 1fr;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .results-actions {
    flex-direction: column;
  }
}
</style>
