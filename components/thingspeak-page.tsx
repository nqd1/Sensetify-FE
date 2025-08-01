"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Cloud, Brain, TreePine, Zap, Network, Target, ChevronDown, Play, Pause } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface CollapsibleProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function Collapsible({ title, children, defaultOpen = false }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-border rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <span className="font-medium">{title}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-border">
          {children}
        </div>
      )}
    </div>
  )
}

interface ThingSpeakData {
  channel_id: string
  name: string
  description: string
  field1: string
  field2: string
  field3: string
  field4: string
  field5: string
  field6: string
  field7: string
  field8: string
  created_at: string
  updated_at: string
  last_entry_id: number
}

interface PredictionResult {
  class_id?: number
  class_label: string
  probability?: number
}

interface ThingSpeakPrediction {
  input_data?: number[]
  predictions: {
    base_1: PredictionResult
    base_2: PredictionResult
    base_3: PredictionResult
    base_4: PredictionResult
    meta: PredictionResult
  }
  thingspeak_data?: ThingSpeakData  // Optional for backward compatibility
  metadata: {
    timestamp: string
    sensor_names: string[]
    thingspeak?: {
      records_fetched: number
      latest_entry_time: string
      api_key: string
    }
    model_versions?: {
      [key: string]: string
    }
  }
}

const odorLabels: { [key: string]: string } = {
  "Thịt loại 1": "Thịt loại 1",
  "Thịt loại 2": "Thịt loại 2", 
  "Thịt loại 3": "Thịt loại 3",
  "Thịt loại 4": "Thịt loại 4",
  "Thịt hỏng": "Thịt hỏng",
}

export default function ThingSpeakPage() {
  const apiKey = "P91SEPV5ZZG00Y4S"
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ThingSpeakPrediction | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Auto-refresh states
  const [isAutoRefresh, setIsAutoRefresh] = useState(false)
  const refreshInterval = 30 // seconds - fixed to 30s, not configurable by user
  const abortControllerRef = useRef<AbortController | null>(null)
  const isRunningRef = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handlePredict = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/predict/thingspeak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra khi kết nối ThingSpeak")
      // Stop auto-refresh on error
      setIsAutoRefresh(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Sleep function for delay
  const sleep = (seconds: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(resolve, seconds * 1000)
      
      // Handle abort
      if (abortControllerRef.current) {
        abortControllerRef.current.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId)
          reject(new Error('Aborted'))
        })
      }
    })
  }

  // Auto-refresh loop with while true pattern
  const startAutoRefreshLoop = useCallback(async () => {
    if (isRunningRef.current) return // Already running
    
    isRunningRef.current = true
    abortControllerRef.current = new AbortController()
    
    try {
      while (isRunningRef.current && !abortControllerRef.current?.signal.aborted) {
        // Fetch data
        await handlePredict()
        
        if (!isRunningRef.current) break
        
        // Wait for next refresh
        await sleep(refreshInterval)
      }
    } catch (err) {
      if (err instanceof Error && err.message !== 'Aborted') {
        console.error('Auto-refresh error:', err)
        setError("Có lỗi xảy ra trong quá trình auto-refresh")
        setIsAutoRefresh(false)
      }
    } finally {
      isRunningRef.current = false
    }
  }, [handlePredict])

  const stopAutoRefresh = useCallback(() => {
    isRunningRef.current = false
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  const toggleAutoRefresh = () => {
    if (isAutoRefresh) {
      stopAutoRefresh()
      setIsAutoRefresh(false)
    } else {
      setIsAutoRefresh(true)
    }
  }



  // Auto-refresh effect
  useEffect(() => {
    if (isAutoRefresh) {
      startAutoRefreshLoop()
    } else {
      stopAutoRefresh()
    }
  }, [isAutoRefresh, startAutoRefreshLoop, stopAutoRefresh])



  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Cloud className="mr-2 h-5 w-5" />
            Dự đoán từ ThingSpeak
          </CardTitle>
          <CardDescription>Thu thập dữ liệu từ cảm biến khí, nhiệt độ, độ ẩm và thực hiện dự đoán chất lượng thực phẩm</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-refresh control */}
          <div className="flex justify-center">
            <Button
              variant={isAutoRefresh ? "destructive" : "default"}
              onClick={toggleAutoRefresh}
              disabled={isLoading}
              className="w-full max-w-md"
            >
              {isAutoRefresh ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Dừng thu thập dữ liệu
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Bắt đầu thu thập dữ liệu
                </>
              )}
            </Button>
          </div>




        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <>
          {/* Meta Model Result - Main Result */}
          {result.predictions.meta && (
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="h-5 w-5 mr-2" />
                  Kết quả dự đoán cuối cùng (Mô hình tổng hợp)
                </CardTitle>
                <CardDescription>
                  Kết quả được tối ưu hóa từ 4 mô hình AI cơ sở với dữ liệu ThingSpeak
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="text-4xl font-bold text-primary">
                    {odorLabels[result.predictions.meta.class_label] || result.predictions.meta.class_label}
                  </div>
                  <div className="text-lg text-muted-foreground">
                    Độ tin cậy: {((result.predictions.meta?.probability || 0) * 100).toFixed(2)}%
                  </div>
                  <Badge variant="default" className="text-sm px-4 py-2">
                    Meta Model
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Base Models in Collapsible */}
          <Collapsible title="Chi tiết kết quả từ 4 mô hình cơ sở" defaultOpen={false}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                  <Brain className="h-4 w-4 mr-2" />
                  <CardTitle className="text-sm font-medium">Base Model 1</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{odorLabels[result.predictions.base_1.class_label] || result.predictions.base_1.class_label}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Độ tin cậy: {((result.predictions.base_1.probability || 0) * 100).toFixed(2)}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                  <TreePine className="h-4 w-4 mr-2" />
                  <CardTitle className="text-sm font-medium">Base Model 2</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{odorLabels[result.predictions.base_2.class_label] || result.predictions.base_2.class_label}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                  <Zap className="h-4 w-4 mr-2" />
                  <CardTitle className="text-sm font-medium">Base Model 3</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{odorLabels[result.predictions.base_3.class_label] || result.predictions.base_3.class_label}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                  <Network className="h-4 w-4 mr-2" />
                  <CardTitle className="text-sm font-medium">Base Model 4</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{odorLabels[result.predictions.base_4.class_label] || result.predictions.base_4.class_label}</div>
                </CardContent>
              </Card>
            </div>
          </Collapsible>

          {/* Sensor Data */}
          <Card>
            <CardHeader>
              <CardTitle>Dữ liệu cảm biến trung bình từ ThingSpeak</CardTitle>
            </CardHeader>
            <CardContent>
              {result.input_data && result.input_data.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {['Temp', 'Humid'].map((sensorName, index) => {
                      const unit = sensorName === 'Temp' ? '°C' : '%';
                      return (
                        <div key={sensorName} className="text-center p-3 bg-muted rounded">
                          <div className="text-xs text-muted-foreground">{sensorName}</div>
                          <div className="font-mono text-lg font-bold">
                            {result.input_data?.[index + 2] ? `${result.input_data[index + 2].toFixed(2)}${unit}` : 'N/A'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Dữ liệu trung bình được tính từ {result.metadata?.thingspeak?.records_fetched || 'nhiều'} bản ghi. <br />
                    Dữ liệu được lấy lúc: {new Date(result.metadata.timestamp).toLocaleString("vi-VN")}
                  </p>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="text-sm text-muted-foreground mb-4">
                    Dữ liệu cảm biến chi tiết không có sẵn trong response từ server.
                  </div>
                  <div className="grid grid-cols-2 gap-4 opacity-50">
                    {['Temp', 'Humid'].map((sensorName) => {
                      const unit = sensorName === 'Temp' ? '°C' : '%';
                      return (
                        <div key={sensorName} className="text-center p-3 bg-muted rounded">
                          <div className="text-xs text-muted-foreground">{sensorName}</div>
                          <div className="font-mono text-lg font-bold">--{unit}</div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Kết quả dự đoán vẫn được tính toán từ dữ liệu ThingSpeak. <br />
                    Dự đoán được thực hiện lúc: {new Date(result.metadata.timestamp).toLocaleString("vi-VN")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
