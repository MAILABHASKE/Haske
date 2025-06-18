<template>
  <div class="report-page">

    <header>
      <h1> Report</h1>
    </header>

    <!-- Row 1: Patient Information -->
    <section class="full-width-section patient-info">
      <h2>Patient Information</h2>
      <div class="patient-row">
        <div class="form-group">
          <label><i class="fas fa-user"></i> Name</label>
          <span class="patient-detail">{{ patientName || manualPatientName }}</span>
          <input v-if="!patientName" type="text" v-model="manualPatientName" placeholder="Enter patient name" />
        </div>
        <div class="form-group">
          <label><i class="fas fa-id-badge"></i> Patient ID</label>
          <span class="patient-detail">{{ patientId || 'N/A' }}</span>
        </div>
        <div class="form-group">
          <label><i class="fas fa-calendar-alt"></i> Date of Birth</label>
          <span class="patient-detail">{{ patientDob || manualPatientDob }}</span>
          <input v-if="!patientDob" type="date" v-model="manualPatientDob" />
        </div>
          <div class="form-group">
          <label><i class="fas fa-venus-mars"></i> Gender</label>
          <span class="patient-detail">{{ formattedGender }}</span>
          <input v-if="!patientGender" type="text" v-model="manualPatientGender" placeholder="Enter gender" />
        </div>
      </div>
      <div class="patient-row">
        <div class="form-group">
          <label><i class="fas fa-calendar-day"></i> Study Date</label>
          <span class="patient-detail">{{ studyDate || manualStudyDate }}</span>
          <input v-if="!studyDate" type="date" v-model="manualStudyDate" />
        </div>
        <div class="form-group">
          <label><i class="fas fa-stethoscope"></i> Study Type</label>
          <span class="patient-detail">{{ studyType || manualStudyType }}</span>
          <input v-if="!studyType" type="text" v-model="manualStudyType" placeholder="Enter study type" />
        </div>
        
          <div class="form-group">
          <label><i class="fas fa-stethoscope"></i> Modality</label>
          <span class="patient-detail">{{ Modality|| manualModality }}</span>
          <input v-if="!Modality" type="text" v-model="manualModality" placeholder="Enter Modality" />
        </div>
        
        
         <div class="form-group">
          <label><i class="fas fa-stethoscope"></i> Body Part</label>
          <span class="patient-detail">{{ BodyPartExamined|| manualBodyPartExamined }}</span>
          <input v-if="!BodyPartExamined" type="text" v-model="manualBodyPartExamined" placeholder="Enter Modality" />
        </div>
        
        <div class="form-group">
          <label><i class="fas fa-stethoscope"></i> Institution Name </label>
          <span class="patient-detail">{{ InstitutionName || manualInstitutionName  }}</span>
          <input v-if="!InstitutionName " type="text" v-model="manualInstitutionName " placeholder="Enter Institution Name " />
        </div>
  
        
        <div class="form-group">
          <label><i class="fas fa-stethoscope"></i> Referring Physician</label>
          <span class="patient-detail">{{ referringPhysicianName }}</span>
        </div>
      </div>
    </section>

    <!-- Row 2: Report Content -->
    <section class="full-width-section report-content">
      <h2>Report Content</h2>
      <div class="form-column">
        <div class="form-group">
          <textarea v-model="clinicalindications" placeholder="Enter Clinical Indications"></textarea>
        </div>
        <div class="form-group">
          <textarea v-model="procedure" placeholder="Enter Procedure"></textarea>
        </div>
        <div class="form-group">
          <textarea v-model="technique" placeholder="Enter Technique"></textarea>
        </div>
        <div class="form-group">
          <textarea v-model="findings" placeholder="Enter Findings"></textarea>
        </div>
        <div class="form-group">
          <textarea v-model="overallImpression" placeholder="Overall Impression"></textarea>
        </div>
        <div class="form-group">
          <textarea v-model="comparison" placeholder="Comparison"></textarea>
        </div>
      </div>
    </section>

    <!-- Row 3: Radiologist Section -->
    <section class="full-width-section radiologist-info">
      <h2>Radiologist Details</h2>
      <div class="form-group">
        <textarea v-model="radiologistName" placeholder="Radiologist Name"></textarea>
      </div>

      <div class="signature-section">
        <label>Signature</label>
        <div class="signature-container">
          <canvas id="signature-pad" width="300" height="150" style="border: 1px solid #ccc;"></canvas>
          <div class="signature-actions">
            <button @click="clearSignature" class="action-btn">Clear Signature</button>
            <input type="file" @change="uploadSignature" accept="image/*" class="browse-button" />
          </div>
        </div>

        <div class="form-group">
          <label><i class="fas fa-calendar-alt"></i> Signature Date</label>
          <input type="date" v-model="signatureDate" class="date-input" />
        </div>
      </div>
    </section>

    <!-- Action Buttons -->
    <section class="actions">
      <button @click="saveReport" class="action-btn">Save Report</button>
      <button @click="downloadReportAsPDF" class="action-btn secondary">Download Report</button>
    </section>
  </div>
</template>


<script>
import api from "../orthancApi"; // Ensure your API is correctly imported
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import SignaturePad from 'signature_pad';
import { saveAs } from "file-saver";
import logo from '../assets/images/haske.png'; // Update the path as necessary
import { mapActions } from 'vuex';

export default {
  props: ['id', 'name', 'birthDate', 'sex'],
  data() {
    return {
      // Patient and study details
      patientName: this.name || '',
      patientId: this.id || '',
      patientDob: this.birthDate || '',
      patientGender: this.sex || '',
      studyDate: '',
      studyType: '',
      Modality: '',
      BodyPartExamined: '',
      InstitutionName: '',
      ReferringPhysicianName: '',
      clinicalindications: '',
      procedure: '',
      technique: '',
      findings: '',
      overallImpression: '',
      comparison: '',
      radiologistName: '',
      signaturePad: null,
      signatureImage: null,
      signatureDate: '',
     // reportState: 'empty', // Initial state
     
      // Manual input for patient data if missing
      manualPatientName: '',
      manualPatientDob: '',
      manualPatientGender: '',
      manualStudyDate: '',
      manualStudyType: '',
      manualModality: '',
      manualBodyPartExamined: '',
      manualInstitutionName: '',     
      
    };
  },
  computed: {
    formattedGender() {
      return this.patientGender === 'F' ? 'Female' : this.patientGender === 'M' ? 'Male' : this.patientGender || this.manualPatientGender || '';
    }
  },
 
  
  methods: {
   formatDate(dateStr) {
      if (!dateStr) return '';
      const [year, month, day] = [dateStr.slice(0, 4), dateStr.slice(4, 6), dateStr.slice(6)];
      return `${year}/${month}/${day}`;
    },
    formatName(name) {
      // Remove special characters and extra spaces
      return name.replace(/[^\w\s]|_/g, ' ').replace(/\s+/g, ' ').trim();
    },
    
   

    // Fetch patient details
    async fetchPatientDetails() {
    const orthancId = this.$route.params.id;
    try {
      // Fetch study data from Orthanc
      const studyData = await api.getStudy(orthancId);
      const StudySeriesArray = await api.getStudySeries(orthancId);
      console.log('Study Series:', StudySeriesArray);

      // Check if there are any series and get the first one
      const StudySeries = StudySeriesArray.length > 0 ? StudySeriesArray[0] : null;

      // Set patient details from the fetched data
      this.patientName = this.formatName(studyData.PatientMainDicomTags.PatientName) || '';
      this.patientId = studyData.PatientMainDicomTags.PatientID || '';
      this.patientDob = this.formatDate(studyData.PatientMainDicomTags.PatientBirthDate) || '';
      this.patientGender = studyData.PatientMainDicomTags.PatientSex || '';
      this.studyDate = this.formatDate(studyData.MainDicomTags.StudyDate) || '';
      this.studyType = studyData.MainDicomTags.StudyDescription || '';
      this.ReferringPhysicianName = this.formatName(studyData.MainDicomTags.ReferringPhysicianName) || '';

      // Ensure StudySeries is not null before accessing its properties
      if (StudySeries) {
        this.Modality = StudySeries.MainDicomTags.Modality || '';
        this.BodyPartExamined = StudySeries.MainDicomTags.BodyPartExamined || '';
      } else {
        this.Modality = '';
        this.BodyPartExamined = '';
      }

      this.InstitutionName = studyData.MainDicomTags.InstitutionName || '';
      
    } catch (error) {
      console.error('Error fetching patient details:', error);
    }
  },
  
  clearSignature() {
      this.signaturePad.clear();
      this.signatureImage = null; // Reset uploaded image
    },
    uploadSignature(event) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          this.signaturePad.clear(); // Clear previous signature
          this.signaturePad.fromDataURL(img.src);
        };
      };
      reader.readAsDataURL(file);
    },
    
    ...mapActions(['updateReportStatus']),


isBlankSignature(dataURL) {
    const blankCanvas = document.createElement('canvas');
    const context = blankCanvas.getContext('2d');
    blankCanvas.width = this.signaturePad._canvas.width;
    blankCanvas.height = this.signaturePad._canvas.height;

    return blankCanvas.toDataURL() === dataURL;
  },
// Save report to local storage
async saveReport() {
  const orthancId = this.$route.params.id;

  // Prepare report data
  const reportData = {
    patientName: this.patientName || this.manualPatientName,
    patientId: this.patientId,
    patientDob: this.patientDob || this.manualPatientDob,
    patientGender: this.patientGender || this.manualPatientGender,
    studyDate: this.studyDate || this.manualStudyDate,
    studyType: this.studyType || this.manualStudyType,
    Modality: this.Modality || this.manualModality,
    BodyPartExamined: this.BodyPartExamined || this.manualBodyPartExamined,
    InstitutionName: this.InstitutionName || this.manualInstitutionName,
    clinicalindications: this.clinicalindications,
    procedure: this.procedure,
    technique: this.technique,
    findings: this.findings,
    overallImpression: this.overallImpression,
    comparison: this.comparison,
    radiologistName: this.radiologistName,
    signature: this.signaturePad.toDataURL(),
    signatureDate: this.signatureDate,
  };

  // Determine report status
// Check the report status
let status = 'empty';

// Determine report status based on findings and signature
const hasFindings = reportData.findings && reportData.findings.trim() !== '';
const hasSignature = !this.signaturePad.isEmpty(); // Check if the signature pad has a valid signature

if (hasFindings) {
  status = hasSignature ? 'filled' : 'filling'; // 'filled' only when findings and signature exist
}

// Save status to localStorage
localStorage.setItem(`reportStatus_${orthancId}`, status);

// Update Vuex store for consistency across components
this.$store.dispatch('updateReportStatus', { orthancId, status });

  // Send report to server
  try {
    const response = await fetch('https://haske.online:8090/save-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orthancId, reportData }),
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to save report: ${response.status} - ${errorDetails}`);
    }

    alert('Report saved successfully!');
  } catch (error) {
    console.error('Error saving report:', error);
    alert('Failed to save report. Please try again.');
  }
},

// Load report from server
async loadReport() {
  const orthancId = this.$route.params.id;
  try {
    const response = await fetch(`https://haske.online:8090/load-report/${orthancId}`);
    if (response.ok) {
      const reportData = await response.json();

      // Existing functionality: Check and load signature
      if (reportData.signature) {
        const img = new Image();
        img.src = reportData.signature;

        img.onload = () => {
          this.signaturePad.clear();
          this.signaturePad.fromDataURL(img.src);

          // Check if the loaded signature is blank
          const isSignatureEmpty = this.signaturePad.isEmpty() || this.isBlankSignature(this.signaturePad.toDataURL());
          const hasFindings = reportData.findings && reportData.findings.trim() !== '';
          let status = 'empty';

          if (hasFindings) {
            status = !isSignatureEmpty ? 'filled' : 'filling'; // Validate findings and signature
          }
          
          // Save status to localStorage and Vuex
          localStorage.setItem(`reportStatus_${orthancId}`, status);
          this.$store.dispatch('updateReportStatus', { orthancId, status });
        };
      } else {
        this.signaturePad.clear();
        localStorage.setItem(`reportStatus_${orthancId}`, 'empty');
        this.$store.dispatch('updateReportStatus', { orthancId, status: 'empty' });
      }

      // Set other report fields
      this.patientName = reportData.patientName || '';
      this.manualPatientName = this.patientName;

      this.patientDob = reportData.patientDob || '';
      this.manualPatientDob = this.patientDob;

      this.patientGender = reportData.patientGender || '';
      this.manualPatientGender = this.patientGender;

      this.studyDate = reportData.studyDate || '';
      this.manualStudyDate = this.studyDate;

      this.studyType = reportData.studyType || '';
      this.manualStudyType = this.studyType;

      this.Modality = reportData.Modality || '';
      this.manualModality = this.Modality;

      this.BodyPartExamined = reportData.BodyPartExamined || '';
      this.manualBodyPartExamined = this.BodyPartExamined;

      this.InstitutionName = reportData.InstitutionName || '';
      this.manualInstitutionName = this.InstitutionName;

      this.ReferringPhysicianName = reportData.ReferringPhysicianName || '';
      this.findings = reportData.findings || '';
      this.clinicalindications = reportData.clinicalindications || '';
      this.procedure = reportData.procedure || '';
      this.technique = reportData.technique || '';
      this.overallImpression = reportData.overallImpression || '';
      this.comparison = reportData.comparison || '';
      this.radiologistName = reportData.radiologistName || '';
      this.signatureDate = reportData.signatureDate || '';

    } else {
      throw new Error('Failed to load report.');
    }
  } catch (error) {
    console.error('Failed to load report:', error);
    localStorage.setItem(`reportStatus_${orthancId}`, 'empty');
    this.$store.dispatch('updateReportStatus', { orthancId, status: 'empty' });
    alert('No Report filled yet! Please fill in your reports.');
  }
},

async downloadReportAsPDF() {
  try {
    const orthancId = this.$route.params.id;
    const doc = new jsPDF();
    
    // Load logo with proper error handling
    const img = new Image();
    img.src = logo;
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => {
        console.warn("Logo failed to load, proceeding without it");
        resolve();
      };
      setTimeout(() => resolve(), 500); // Fallback timeout
    });

    let pageNumber = 1; // Initialize the page number
    let totalPages = 0; // Will be calculated later

    const addHeader = () => {
      try {
        if (img.complete && img.naturalHeight !== 0) {
          doc.addImage(img, 'PNG', 85, 5, 40, 10); // Add logo
        }
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("Report", 105, 30, { align: "center" }); // Center the title
        doc.setDrawColor(0, 0, 0);
        doc.line(20, 35, 190, 35); // Horizontal line under title
      } catch (error) {
        console.error("Error in addHeader:", error);
      }
    };

    const addFooter = (currentPage, totalPages) => {
      try {
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.text("sourced by Haske.", 175, 290);
        
        // Add page number if totalPages is available
        if (totalPages > 0) {
          doc.text(`Page ${currentPage} of ${totalPages}`, 105, 290, { align: "center" });
        }
      } catch (error) {
        console.error("Error in addFooter:", error);
      }
    };

    const addNewPage = () => {
      doc.addPage();
      addHeader();
      currentY = 40; // Reset Y position after adding a new page
      doc.setFontSize(12);
    };

    // Add Header for the first page
    addHeader();

    let currentY = 40; // Starting Y position for the content
    const detailsSpacing = 7;
    const pageHeight = doc.internal.pageSize.getHeight();
    const bottomMargin = 20;

    const checkSpace = (requiredSpace) => {
      return (currentY + requiredSpace) > (pageHeight - bottomMargin);
    };

    // Patient Information Section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Patient Information:", 105, currentY, { align: "center" });
    currentY += 5;
    doc.line(20, currentY, 190, currentY);
    currentY += 10;

    // Patient Details
    const patientDetails = [
      { label: "Patient Name:", value: this.patientName || "N/A" },
      { label: "Patient ID:", value: this.patientId || "N/A" },
      { label: "Date of Birth:", value: this.patientDob || "N/A" },
      { label: "Gender:", value: this.patientGender || "N/A" },
      { label: "Institution Name:", value: this.InstitutionName || "N/A" },
      { label: "Referring Physician:", value: this.ReferringPhysicianName || "N/A" }
    ];

    for (const detail of patientDetails) {
      if (checkSpace(detailsSpacing)) {
        addNewPage();
      }
      doc.setFont("helvetica", "bold");
      doc.text(detail.label, 20, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(detail.value || "N/A", 60, currentY);
      currentY += detailsSpacing;
    }

    // Examination Details Section
    currentY += 5;
    doc.line(20, currentY - 5, 190, currentY - 5);
    doc.setFont("helvetica", "bold");
    doc.text("Examination Details:", 105, currentY, { align: "center" });
    doc.line(20, currentY + 5, 190, currentY + 5);
    currentY += 15;

    const examDetails = [
      { label: "Body Parts:", value: this.BodyPartExamined || "N/A", x: 20 },
      { label: "Modality:", value: this.Modality || "N/A", x: 20 },
      { label: "Study Date:", value: this.studyDate || "N/A", x: 110 },
      { label: "Study Type:", value: this.studyType || "N/A", x: 110 }
    ];

    let initialY = currentY;

    for (let i = 0; i < 2; i++) {
      if (checkSpace(detailsSpacing)) {
        addNewPage();
      }
      const detail = examDetails[i];
      doc.setFont("helvetica", "bold");
      doc.text(detail.label, detail.x, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(detail.value, detail.x + 40, currentY);
      currentY += detailsSpacing;
    }

    currentY = initialY;
    for (let i = 2; i < examDetails.length; i++) {
      if (checkSpace(detailsSpacing)) {
        addNewPage();
      }
      const detail = examDetails[i];
      doc.setFont("helvetica", "bold");
      doc.text(detail.label, detail.x, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(detail.value, detail.x + 40, currentY);
      currentY += detailsSpacing;
    }

    // Report Content Section
    doc.line(20, currentY, 190, currentY);
    currentY += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Report Content:", 105, currentY, { align: "center" });
    currentY += 5;
    doc.line(20, currentY, 190, currentY);
    currentY += 10;

    const reportSections = [
      { label: "Clinical Indications", value: this.clinicalindications || "N/A" },
      { label: "Procedure", value: this.procedure || "N/A" },
      { label: "Technique", value: this.technique || "N/A" },
      { label: "Findings", value: this.findings || "N/A" },
      { label: "Overall Impression", value: this.overallImpression || "N/A" },
      { label: "Comparison", value: this.comparison || "N/A" }
    ];

    for (const section of reportSections) {
      if (checkSpace(20)) {
        addNewPage();
      }
      doc.setFont("helvetica", "bold");
      doc.text(section.label, 20, currentY);
      doc.setFont("helvetica", "normal");
      const splitText = doc.splitTextToSize(section.value, 175);
      currentY += 5;

      for (const [index, line] of splitText.entries()) {
        if (checkSpace(detailsSpacing)) {
          addNewPage();
        }
        doc.text(line, 20, currentY + (index * 6));
      }
      currentY += (splitText.length * 6) + detailsSpacing;
    }

    // Radiologist Details Section
    if (checkSpace(50)) {
      addNewPage();
    }
    doc.setFont("helvetica", "bold");
    currentY += 5;
    doc.line(20, currentY, 190, currentY);
    currentY += 10;
    doc.text("Name:", 20, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(this.radiologistName || "N/A", 40, currentY);
    currentY += 10;

    // Signature
    if (this.signaturePad && !this.signaturePad.isEmpty()) {
      try {
        const signatureDataUrl = this.signaturePad.toDataURL();
        doc.addImage(signatureDataUrl, 'PNG', 20, currentY - 5, 50, 20);
        currentY += 25;
      } catch (error) {
        console.error("Error adding signature:", error);
      }
    }

    // Signature Date
    doc.setFont("helvetica", "bold");
    doc.text("Signature Date:", 20, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(this.signatureDate || "N/A", 58, currentY);
    currentY += 10;

    // Calculate total pages and update page numbers
    totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(i, totalPages);
    }

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);

    try {
      // Upload to server
      const formData = new FormData();
      formData.append('pdf', pdfBlob, `${this.patientName}_Medical_Imaging_Report.pdf`);
      formData.append('orthancId', orthancId);

      const uploadResponse = await fetch('https://haske.online:8090/upload-pdf', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      const { url } = await uploadResponse.json();
      
      // Copy URL to clipboard
      try {
        await navigator.clipboard.writeText(url);
        alert(`PDF report generated!\nURL copied to clipboard: ${url}`);
      } catch (clipboardError) {
        alert(`PDF report generated!\nShareable URL: ${url}`);
      }
        // Save locally as well
        doc.save(`${this.patientName}_Medical_Imaging_Report.pdf`);
      
      // Clean up object URL
      URL.revokeObjectURL(pdfUrl);

    } catch (uploadError) {
      console.error('Upload failed, saving locally:', uploadError);
      doc.save(`${this.patientName}_Medical_Imaging_Report.pdf`);
      alert('PDF saved locally. Could not generate shareable URL.');
    }

  } catch (mainError) {
    console.error('PDF generation failed:', mainError);
    alert('Failed to generate PDF. Please try again.');
  }
},
  mounted() {
    const canvas = document.getElementById('signature-pad');
    this.signaturePad = new SignaturePad(canvas);
    // Load report data if available
    this.loadReport();
    // Fetch patient details if applicable
    this.fetchPatientDetails();
  },
}
};

</script>


<style scoped>
/* Global styling for dark theme with colorful accents */
.report-page {
  display: grid;
  grid-template-columns: 1fr;
  grid-gap: 30px;
  padding: 20px;
  max-width: 1550px;
  margin: 0 auto;
  font-family: 'montserrat', sans-serif;
  color: #fff;
  background-color: #2e353d;
}

h1 {
  font-size: 48px;
  text-align: center;
  color: #ffffff;
  margin-bottom: 15px;
  font-weight: bold;
  
}

h2 {
  font-size: 24px;
  color: #fff;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
}

.full-width-section {
  grid-column: span 3;
  background: #1e242ac7;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  border: 1px solid #555;
  margin-bottom: 20px;
}

.patient-row {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 10px;
  flex: 1 1 20%; 
  margin-right: 1rem;
}

.form-group:last-child {
  margin-right: 0; /* Remove margin for the last child */
}

.patient-detail {
  display: block; /* Ensure the detail is displayed as a block element */
  color: #ffffff; /* Adjust color as needed */
  margin-top: 0.25rem; /* Space between label and detail */
}

.form-column {
  display: flex;
  flex-direction: column;
}

label {
  font-size: 16px;
  color: #fff;
  margin-bottom: 5px;
  font-weight: bold;
}

.signature-section {
  margin-top: 20px;
}

.signature-container {
  display: flex;
  flex-direction: column; /* Stack items vertically */
  align-items: center; /* Center align canvas */
  margin-bottom: 15px;
}

.signature-actions {
  display: flex;
  justify-content: space-between; /* Space between buttons */
  width: 100%; /* Full width for alignment */
  margin-top: 10px;
}


input[type="text"], textarea {
  width: 100%;
  padding: 10px;
  font-size: 14px;
  border: 1px solid #888;
  border-radius: 4px;
  background-color: #444;
  color: #fff;
  transition: all 0.3s ease;
  resize: vertical;
}

input[type="text"]:hover, textarea:hover {
  border-color: #ffcc00;
}

textarea {
  width: 100%;
  height: 80px;
  padding: 10px;
  border: 1px solid #bdc3c7;
  border-radius: 5px;
  overflow-y: auto;
}

.actions {
  display: center;
  text-align: center;
  margin-top: 30px;
  gap: 10px;
}

.action-btn {
  padding: 10px 20px;
  font-size: 16px;
  border-radius: 4px;
  background-color: #ffcc00;
  color: #2c2c2c;
  border: none;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.3s ease;
  margin-right: 10px;
}

.browse-button {
  margin-left: 10px; /* Space between button and input */
}

.date-input {
  width: 100%; /* Full width for date input */
  padding: 5px; /* Padding for better spacing */
}

.action-btn.secondary {
  background-color: #aaa;
}

.action-btn:hover {
  background-color: #e6b800;
  transform: scale(1.05);
}

@media (max-width: 768px) {
  .patient-row {
    flex-direction: column;
  }
}
</style>
