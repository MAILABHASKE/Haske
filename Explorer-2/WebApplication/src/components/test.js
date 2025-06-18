import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Box, Typography, CircularProgress, Grid, Paper, 
  Button, Card, CardContent, CardMedia, Divider,
  Chip, Stack, IconButton, Modal, Alert,
  Container, Avatar, useTheme
} from '@mui/material';
import axios from 'axios';
import { 
  Info as InfoIcon, GitHub as GitHubIcon, 
  ZoomIn as ZoomInIcon, Download as DownloadIcon,
  Save as SaveIcon, Refresh as RefreshIcon, 
  Close as CloseIcon, Science as ScienceIcon
} from '@mui/icons-material';

const AIAnalysis = () => {
  const theme = useTheme({
    palette: {
      primary: {
        main: '#0f172a',
        contrastText: '#ffffff'
      },
      secondary: {
        main: '#3b82f6',
        contrastText: '#ffffff'
      },
      background: {
        default: '#f8fafc',
        paper: '#ffffff'
      }
    },
    shape: {
      borderRadius: 12
    },
    typography: {
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      h1: {
        fontWeight: 700,
        fontSize: '2.5rem'
      },
      h2: {
        fontWeight: 600,
        fontSize: '2rem'
      },
      h3: {
        fontWeight: 600,
        fontSize: '1.75rem'
      },
      h4: {
        fontWeight: 600,
        fontSize: '1.5rem'
      },
      h5: {
        fontWeight: 600,
        fontSize: '1.25rem'
      },
      h6: {
        fontWeight: 600,
        fontSize: '1.1rem'
      }
    }
  });

  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const [seriesDetails, setSeriesDetails] = useState([]);
  const [patientDetails, setPatientDetails] = useState(null);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [githubRepo, setGithubRepo] = useState('');
  
  const orthancId = query.get('orthancId');
  const initialModality = query.get('modality');
  const initialBodyPart = query.get('bodyPart');

  const formatPatientName = (name) => {
    if (!name) return 'N/A';
    return name.replace(/\\/g, ' ').trim();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      return `${year}-${month}-${day}`;
    } catch {
      return dateString;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchConfig = async () => {
      try {
        const configResponse = await axios.get('https://haske.online:8090/api/ai/config');
        if (isMounted) {
          setAvailableModels(configResponse.data.models || []);
          setGithubRepo(configResponse.data.githubRepo || 'https://github.com/MAILABHASKE/mailab-models');
        }
      } catch (err) {
        console.error('Failed to fetch config:', err);
        if (isMounted) {
          setAvailableModels([]);
          setGithubRepo('');
        }
      }
    };

    const fetchStudyDetails = async () => {
      try {
        const [studyResponse, seriesResponse] = await Promise.all([
          axios.get(`https://haske.online:5000/studies/${orthancId}`),
          axios.get(`https://haske.online:5000/studies/${orthancId}/series`)
        ]);

        if (isMounted) {
          setPatientDetails(studyResponse.data.PatientMainDicomTags || {});
          
          const seriesData = await Promise.all(
            seriesResponse.data.map(async (series) => {
              const seriesDetails = await axios.get(`https://haske.online:5000/series/${series.ID}`);
              return {
                ...series,
                Modality: seriesDetails.data.MainDicomTags?.Modality || 'UNKNOWN',
                BodyPartExamined: seriesDetails.data.MainDicomTags?.BodyPartExamined || 'UNKNOWN'
              };
            })
          );

          setSeriesDetails(seriesData);
        }
      } catch (err) {
        console.error('Failed to fetch study details:', err);
        if (isMounted) {
          setSeriesDetails([{
            Modality: initialModality || 'UNKNOWN',
            BodyPartExamined: initialBodyPart || 'UNKNOWN'
          }]);
          setPatientDetails({});
        }
      }
    };

    const startAnalysis = async () => {
      try {
        const { data } = await axios.post('https://haske.online:8090/api/ai/analyze', {
          orthancId,
          modality: initialModality || seriesDetails[0]?.Modality,
          bodyPart: initialBodyPart || seriesDetails[0]?.BodyPartExamined
        });
        
        if (!isMounted) return;

        if (data.status === 'no_model') {
          setError(data.message || 'No suitable model found for this study');
          setLoading(false);
          return;
        }
        
        if (data.status === 'queued') {
          const checkStatus = async (jobId) => {
            try {
              const { data: jobData } = await axios.get(
                `https://haske.online:8090/api/ai/job/${jobId}`
              );
              
              if (!isMounted) return;

              if (jobData.status === 'completed') {
                setJob(jobData);
                setLoading(false);
              } else if (jobData.status === 'failed') {
                setError(jobData.results?.error || 'Analysis failed');
                setLoading(false);
              } else {
                setTimeout(() => checkStatus(jobId), 2000);
              }
            } catch (err) {
              if (isMounted) {
                setError('Failed to check job status');
                setLoading(false);
              }
            }
          };
          checkStatus(data.jobId);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.error || err.message || 'Failed to start analysis');
          setLoading(false);
        }
      }
    };

    const initialize = async () => {
      try {
        await Promise.all([fetchConfig(), fetchStudyDetails()]);
        await startAnalysis();
      } catch (err) {
        if (isMounted) {
          setError('Initialization failed');
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [orthancId, initialModality, initialBodyPart]);

  const handleDownloadResults = async () => {
    try {
      const response = await axios.get(`https://haske.online:8090/api/ai/results/${job.jobId}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ai_results_${orthancId}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download results:', err);
      setError('Failed to download results');
    }
  };

  const handleProcessAnother = () => {
    navigate('/');
  };

  const currentModality = initialModality || seriesDetails[0]?.Modality;
  const currentBodyPart = initialBodyPart || seriesDetails[0]?.BodyPartExamined;

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: 3,
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
      }}>
        <ScienceIcon sx={{ 
          fontSize: 80, 
          color: theme.palette.primary.main,
          filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
        }} />
        <CircularProgress 
          size={60} 
          thickness={4} 
          sx={{ color: theme.palette.primary.main }}
        />
        <Typography variant="h4" fontWeight="bold" sx={{ 
          background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, #3b82f6 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textAlign: 'center'
        }}>
          Processing AI Analysis
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center">
          Analyzing {currentModality} scan of {currentBodyPart}
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ 
        py: 4,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Card sx={{ 
          borderRadius: 3,
          boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.1)',
          overflow: 'visible',
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Box sx={{ 
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, #1e3a8a 100%)`,
            color: theme.palette.primary.contrastText,
            p: 4,
            textAlign: 'center',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12
          }}>
            <Typography variant="h3" fontWeight="bold" sx={{ mb: 1 }}>
              AI Analysis Dashboard
            </Typography>
            <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
              Advanced Medical Imaging Analysis
            </Typography>
            {githubRepo && (
              <Button 
                variant="contained"
                color="secondary"
                startIcon={<GitHubIcon />}
                href={githubRepo}
                target="_blank"
                sx={{ 
                  mt: 3,
                  px: 4,
                  py: 1.5,
                  borderRadius: 50,
                  fontWeight: 'bold',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              >
                View Repository
              </Button>
            )}
          </Box>

          <CardContent sx={{ 
            p: 4,
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Box sx={{ 
              backgroundColor: '#fee2e2',
              p: 3,
              borderRadius: 12,
              mb: 4,
              borderLeft: '4px solid #ef4444'
            }}>
              <Typography variant="h5" color="#b91c1c" gutterBottom fontWeight="bold">
                Analysis Not Available
              </Typography>
              <Alert severity="error" sx={{ 
                mb: 2,
                borderRadius: 8,
                backgroundColor: 'rgba(239, 68, 68, 0.1)'
              }}>
                {error}
              </Alert>
              <Typography variant="body1" color="#6b7280">
                We couldn't find a suitable AI model for {currentModality} scans of the {currentBodyPart}.
              </Typography>
            </Box>
            
            {availableModels.length > 0 && (
              <>
                <Divider sx={{ my: 4 }} />
                <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ mb: 4 }}>
                  Available AI Models
                </Typography>
                
                <Box sx={{ 
                  width: '100%',
                  overflowX: 'auto',
                  py: 2,
                  px: 1,
                  '&::-webkit-scrollbar': {
                    height: '6px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: theme.palette.primary.main,
                    borderRadius: '3px',
                  }
                }}>
                  <Grid container spacing={3} sx={{ width: 'max-content', minWidth: '100%' }}>
                    {availableModels.map((model) => (
                      <Grid item key={model.id} xs={12} sm={6} md={4} lg={3}>
                        <Card 
                          sx={{ 
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            border: selectedModel?.id === model.id ? 
                              `2px solid ${theme.palette.primary.main}` : 
                              `1px solid #e2e8f0`,
                            borderRadius: 12,
                            boxShadow: selectedModel?.id === model.id ? 
                              `0 10px 15px -3px rgba(15, 23, 42, 0.2)` : 
                              '0 1px 3px rgba(0, 0, 0, 0.05)',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                            }
                          }}
                          onClick={() => setSelectedModel(model)}
                        >
                          <CardContent sx={{ flexGrow: 1, p: 3 }}>
                            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                              <Avatar sx={{ 
                                bgcolor: theme.palette.primary.main,
                                width: 40,
                                height: 40
                              }}>
                                <ScienceIcon fontSize="small" />
                              </Avatar>
                              <Typography variant="h6" fontWeight="bold">
                                {model.name}
                              </Typography>
                            </Stack>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                              {model.description}
                            </Typography>
                            
                            <Box sx={{ mb: 3 }}>
                              <Typography variant="caption" color="text.secondary" gutterBottom>
                                SUPPORTED MODALITIES
                              </Typography>
                              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                                {model.modality?.map(m => (
                                  <Chip 
                                    key={m} 
                                    label={m} 
                                    size="small" 
                                    sx={{ 
                                      backgroundColor: '#e0f2fe',
                                      color: '#0369a1',
                                      fontSize: '0.7rem',
                                      height: 24
                                    }}
                                  />
                                ))}
                              </Stack>
                            </Box>
                            
                            <Box sx={{ mb: 3 }}>
                              <Typography variant="caption" color="text.secondary" gutterBottom>
                                SUPPORTED BODY PARTS
                              </Typography>
                              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                                {model.body_part?.map(b => (
                                  <Chip 
                                    key={b} 
                                    label={b} 
                                    size="small" 
                                    sx={{
                                      backgroundColor: '#dbeafe',
                                      color: '#1d4ed8',
                                      fontSize: '0.7rem',
                                      height: 24
                                    }}
                                  />
                                ))}
                              </Stack>
                            </Box>
                            
                            {model.github_link && (
                              <Button 
                                fullWidth
                                variant="outlined"
                                size="small"
                                startIcon={<GitHubIcon fontSize="small" />}
                                href={model.github_link}
                                target="_blank"
                                sx={{ 
                                  mt: 1,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  fontSize: '0.75rem',
                                  '&:hover': {
                                    borderWidth: 1
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                View Code
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ 
      py: 4,
      height: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Card sx={{ 
        borderRadius: 3,
        boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        flex: 1,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Box sx={{ 
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, #1e3a8a 100%)`,
          color: theme.palette.primary.contrastText,
          p: 4,
          textAlign: 'center',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12
        }}>
          <Typography variant="h3" fontWeight="bold" sx={{ mb: 1 }}>
            AI Analysis Results
          </Typography>
          <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
            {currentModality} scan of {currentBodyPart}
          </Typography>
          {githubRepo && (
            <Button 
              variant="contained"
              color="secondary"
              startIcon={<GitHubIcon />}
              href={githubRepo}
              target="_blank"
              sx={{ 
                mt: 3,
                px: 4,
                py: 1.5,
                borderRadius: 50,
                fontWeight: 'bold',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
            >
              View Repository
            </Button>
          )}
        </Box>

        <CardContent sx={{ 
          p: 4,
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Grid container spacing={3} sx={{ flex: 1 }}>
            {/* Left Column - Patient Info and Original Image */}
            <Grid item xs={12} md={4}>
              <Stack spacing={3} sx={{ height: '100%' }}>
                {/* Patient Info Card */}
                <Card sx={{ 
                  borderRadius: 12,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  border: '1px solid #e2e8f0'
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      Patient Information
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        NAME
                      </Typography>
                      <Typography variant="body1">
                        {formatPatientName(patientDetails?.PatientName)}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        PATIENT ID
                      </Typography>
                      <Typography variant="body1">
                        {patientDetails?.PatientID || 'N/A'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        DATE OF BIRTH
                      </Typography>
                      <Typography variant="body1">
                        {formatDate(patientDetails?.PatientBirthDate)}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>

                {/* Study Info Card */}
                <Card sx={{ 
                  borderRadius: 12,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  border: '1px solid #e2e8f0'
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      Study Information
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        STUDY DATE
                      </Typography>
                      <Typography variant="body1">
                        {formatDate(seriesDetails[0]?.StudyDate)}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        MODALITY
                      </Typography>
                      <Typography variant="body1">
                        {currentModality}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        BODY PART
                      </Typography>
                      <Typography variant="body1">
                        {currentBodyPart}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>

                {/* Original Image Card */}
                <Card sx={{ 
                  borderRadius: 12,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  border: '1px solid #e2e8f0',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <CardContent sx={{ 
                    p: 2,
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">Original Image</Typography>
                      <IconButton 
                        size="small"
                        onClick={() => setZoomedImage(`https://haske.online:8090/instances/${orthancId}/preview`)}
                        sx={{
                          backgroundColor: theme.palette.primary.light,
                          color: theme.palette.primary.contrastText,
                          '&:hover': {
                            backgroundColor: theme.palette.primary.main
                          }
                        }}
                      >
                        <ZoomInIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Box sx={{ 
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#f8fafc',
                      borderRadius: 8,
                      overflow: 'hidden'
                    }}>
                      <CardMedia
                        component="img"
                        image={`https://haske.online:8090/instances/${orthancId}/preview`}
                        alt="Original DICOM"
                        sx={{ 
                          width: '100%',
                          height: 'auto',
                          objectFit: 'contain',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'scale(1.02)'
                          }
                        }}
                        onClick={() => setZoomedImage(`https://haske.online:8090/instances/${orthancId}/preview`)}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>

            {/* Right Column - Results */}
            <Grid item xs={12} md={8}>
              <Card sx={{ 
                borderRadius: 12,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                border: '1px solid #e2e8f0',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <CardContent sx={{ 
                  p: 3,
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <Typography variant="h5" fontWeight="bold" gutterBottom>
                    AI Analysis Results
                  </Typography>
                  
                  <Grid container spacing={2} sx={{ flex: 1 }}>
                    {job?.results?.outputs?.map((output, index) => (
                      <Grid item xs={12} sm={6} key={index}>
                        <Card sx={{ 
                          borderRadius: 12,
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                          border: '1px solid #e2e8f0',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          <CardContent sx={{ 
                            p: 2,
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column'
                          }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                              <Typography variant="subtitle1" fontWeight="bold">{output.label}</Typography>
                              <IconButton 
                                size="small"
                                onClick={() => setZoomedImage(output.url)}
                                sx={{
                                  backgroundColor: theme.palette.primary.light,
                                  color: theme.palette.primary.contrastText,
                                  '&:hover': {
                                    backgroundColor: theme.palette.primary.main
                                  }
                                }}
                              >
                                <ZoomInIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                            <Box sx={{ 
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#f8fafc',
                              borderRadius: 8,
                              overflow: 'hidden'
                            }}>
                              <CardMedia
                                component="img"
                                image={output.url}
                                alt={output.label}
                                sx={{ 
                                  width: '100%',
                                  height: 'auto',
                                  objectFit: 'contain',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  '&:hover': {
                                    transform: 'scale(1.02)'
                                  }
                                }}
                                onClick={() => setZoomedImage(output.url)}
                              />
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Action Buttons */}
          <Box sx={{ 
            mt: 4,
            display: 'flex',
            justifyContent: 'center',
            gap: 2,
            flexWrap: 'wrap'
          }}>
            <Button 
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadResults}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 8,
                fontWeight: 'bold',
                minWidth: 180,
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
            >
              Download Results
            </Button>
            <Button 
              variant="outlined"
              color="primary"
              startIcon={<SaveIcon />}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 8,
                fontWeight: 'bold',
                minWidth: 180,
                borderWidth: 2,
                '&:hover': {
                  borderWidth: 2
                }
              }}
            >
              Save to PACS
            </Button>
            <Button 
              variant="outlined"
              color="secondary"
              startIcon={<RefreshIcon />}
              onClick={handleProcessAnother}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 8,
                fontWeight: 'bold',
                minWidth: 180,
                borderWidth: 2,
                '&:hover': {
                  borderWidth: 2
                }
              }}
            >
              New Analysis
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Image Zoom Modal */}
      <Modal
        open={Boolean(zoomedImage)}
        onClose={() => setZoomedImage(null)}
        sx={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)'
        }}
      >
        <Box sx={{ 
          position: 'relative',
          bgcolor: 'background.paper',
          p: 2,
          borderRadius: 12,
          outline: 'none',
          maxWidth: '90%',
          maxHeight: '90%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}>
          <IconButton
            sx={{ 
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 1,
              backgroundColor: '#ef4444',
              color: 'white',
              '&:hover': {
                backgroundColor: '#dc2626'
              }
            }}
            onClick={() => setZoomedImage(null)}
          >
            <CloseIcon />
          </IconButton>
          <img 
            src={zoomedImage} 
            alt="Zoomed view" 
            style={{ 
              maxWidth: '100%',
              maxHeight: 'calc(90vh - 32px)',
              display: 'block',
              borderRadius: 8
            }}
          />
        </Box>
      </Modal>
    </Container>
  );
};

export default AIAnalysis;