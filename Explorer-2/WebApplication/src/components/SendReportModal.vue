<template>
  <div class="modal fade" :id="id" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ $t('send_report.modal_title') }}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label for="senderName" class="form-label">{{ $t('send_report.sender_name') }}</label>
            <input type="text" class="form-control" id="senderName" v-model="senderName" required>
          </div>
          <div class="mb-3">
            <label for="doctorEmail" class="form-label">{{ $t('send_report.doctor_email') }}</label>
            <input type="email" class="form-control" id="doctorEmail" v-model="doctorEmail" required>
          </div>
          <div class="mb-3">
            <label for="message" class="form-label">{{ $t('send_report.message') }}</label>
            <textarea class="form-control" id="message" rows="3" v-model="message"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{{ $t('cancel') }}</button>
          <button 
            type="button" 
            class="btn btn-primary" 
            @click="sendReport"
            :disabled="isLoading"
          >
            <span v-if="isLoading">
              <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              {{ $t('sending') }}
            </span>
            <span v-else>{{ $t('send') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SendReportModal',
  props: {
    id: {
      type: String,
      required: true
    },
    orthancId: {
      type: String,
      required: true
    },
    studyInstanceUID: {
      type: String,
      required: true
    },
    sendType: {
      type: String,
      required: true,
      validator: value => ['both', 'image', 'report'].includes(value)
    }
  },
  data() {
    return {
      senderName: '',
      doctorEmail: '',
      message: '',
      isLoading: false
    }
  },
  methods: {
    validateEmail(email) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(email);
    },
    async sendReport() {
      // Validate inputs
      if (!this.senderName?.trim()) {
        this.$toast.error('Please enter your name');
        return;
      }
      
      if (!this.validateEmail(this.doctorEmail)) {
        this.$toast.error('Please enter a valid email address');
        return;
      }

      this.isLoading = true;
      
      try {
        const response = await this.$http.post(
          'https://haske.online:8090/send-report',
          {
            orthancId: this.orthancId,
            studyInstanceUID: this.studyInstanceUID,
            sendType: this.sendType,
            senderName: this.senderName,
            doctorEmail: this.doctorEmail,
            message: this.message
          }
        );
        
        this.$toast.success(this.$t('send_report.success_message'));
        const modal = window.bootstrap?.Modal?.getInstance(document.getElementById(this.id));
        if (modal) {
          modal.hide();
        }
        // Reset form
        this.senderName = '';
        this.doctorEmail = '';
        this.message = '';
      } catch (error) {
        console.error('Error sending report:', error);
        let errorMessage = this.$t('send_report.error_message');
        
        if (error.response) {
          errorMessage = error.response.data?.message || errorMessage;
        } else if (error.request) {
          errorMessage = 'Network error - please check your connection';
        }
        
        this.$toast.error(errorMessage);
      } finally {
        this.isLoading = false;
      }
    }
  }
}
</script>
